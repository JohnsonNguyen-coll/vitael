import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ensureProfile } from "../lib/profile.js";
import { supabase } from "../lib/supabase.js";
import { positiveLimitSchema, walletAddressSchema } from "../lib/validation.js";

const conversationQuerySchema = z.object({
  walletAddress: walletAddressSchema,
  limit: positiveLimitSchema,
  cursor: z.string().datetime().optional(),
  archived: z.enum(["true", "false"]).default("false").transform(value => value === "true"),
});
const conversationBodySchema = z.object({
  walletAddress: walletAddressSchema,
  title: z.string().trim().min(1).max(120).default("New conversation"),
  model: z.string().trim().max(100).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
const conversationParamsSchema = z.object({ id: z.string().uuid() });
const walletQuerySchema = z.object({ walletAddress: walletAddressSchema });
const updateConversationSchema = z.object({
  walletAddress: walletAddressSchema,
  title: z.string().trim().min(1).max(120).optional(),
  isArchived: z.boolean().optional(),
}).refine(value => value.title !== undefined || value.isArchived !== undefined, "No changes supplied");
const messageBodySchema = z.object({
  walletAddress: walletAddressSchema,
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.string().max(100_000).nullable().optional(),
  parts: z.array(z.unknown()).default([]),
  model: z.string().trim().max(100).nullable().optional(),
  inputTokens: z.number().int().nonnegative().nullable().optional(),
  outputTokens: z.number().int().nonnegative().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

async function ownsConversation(id: string, walletAddress: string) {
  const { data, error } = await supabase
    .from("chat_conversations")
    .select("id")
    .eq("id", id)
    .eq("wallet_address", walletAddress)
    .maybeSingle();
  return !error && Boolean(data);
}

export async function chatRoutes(app: FastifyInstance) {
  app.get("/chat/conversations", async (request, reply) => {
    const query = conversationQuerySchema.safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: "Invalid conversation query" });

    let builder = supabase
      .from("chat_conversations")
      .select("id,wallet_address,title,model,is_archived,metadata,created_at,updated_at")
      .eq("wallet_address", query.data.walletAddress)
      .eq("is_archived", query.data.archived)
      .order("updated_at", { ascending: false })
      .limit(query.data.limit + 1);
    if (query.data.cursor) builder = builder.lt("updated_at", query.data.cursor);

    const { data, error } = await builder;
    if (error) return reply.code(503).send({ error: "Unable to load conversations" });
    const hasMore = data.length > query.data.limit;
    const items = hasMore ? data.slice(0, query.data.limit) : data;
    return { items, nextCursor: hasMore ? items.at(-1)?.updated_at ?? null : null };
  });

  app.post("/chat/conversations", {
    config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const body = conversationBodySchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "Invalid conversation payload" });
    await ensureProfile(body.data.walletAddress);

    const { data, error } = await supabase.from("chat_conversations").insert({
      wallet_address: body.data.walletAddress,
      title: body.data.title,
      model: body.data.model ?? null,
      metadata: body.data.metadata,
    }).select().single();
    if (error) return reply.code(503).send({ error: "Unable to create conversation" });
    return reply.code(201).send({ conversation: data });
  });

  app.patch("/chat/conversations/:id", async (request, reply) => {
    const params = conversationParamsSchema.safeParse(request.params);
    const body = updateConversationSchema.safeParse(request.body);
    if (!params.success || !body.success) return reply.code(400).send({ error: "Invalid conversation update" });

    const { data, error } = await supabase.from("chat_conversations").update({
      ...(body.data.title !== undefined && { title: body.data.title }),
      ...(body.data.isArchived !== undefined && { is_archived: body.data.isArchived }),
    }).eq("id", params.data.id).eq("wallet_address", body.data.walletAddress).select().maybeSingle();
    if (error) return reply.code(503).send({ error: "Unable to update conversation" });
    if (!data) return reply.code(404).send({ error: "Conversation not found" });
    return { conversation: data };
  });

  app.delete("/chat/conversations/:id", async (request, reply) => {
    const params = conversationParamsSchema.safeParse(request.params);
    const query = walletQuerySchema.safeParse(request.query);
    if (!params.success || !query.success) return reply.code(400).send({ error: "Invalid delete request" });

    const { data, error } = await supabase.from("chat_conversations")
      .delete().eq("id", params.data.id).eq("wallet_address", query.data.walletAddress).select("id").maybeSingle();
    if (error) return reply.code(503).send({ error: "Unable to delete conversation" });
    if (!data) return reply.code(404).send({ error: "Conversation not found" });
    return reply.code(204).send();
  });

  app.get("/chat/conversations/:id/messages", async (request, reply) => {
    const params = conversationParamsSchema.safeParse(request.params);
    const query = walletQuerySchema.safeParse(request.query);
    if (!params.success || !query.success) return reply.code(400).send({ error: "Invalid messages request" });
    if (!await ownsConversation(params.data.id, query.data.walletAddress)) return reply.code(404).send({ error: "Conversation not found" });

    const { data, error } = await supabase.from("chat_messages")
      .select("id,conversation_id,sequence_no,role,content,parts,model,input_tokens,output_tokens,metadata,created_at")
      .eq("conversation_id", params.data.id).order("sequence_no", { ascending: true });
    if (error) return reply.code(503).send({ error: "Unable to load messages" });
    return { items: data };
  });

  app.post("/chat/conversations/:id/messages", {
    config: { rateLimit: { max: 120, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const params = conversationParamsSchema.safeParse(request.params);
    const body = messageBodySchema.safeParse(request.body);
    if (!params.success || !body.success) return reply.code(400).send({ error: "Invalid message payload" });
    if (!await ownsConversation(params.data.id, body.data.walletAddress)) return reply.code(404).send({ error: "Conversation not found" });

    const { data, error } = await supabase.rpc("append_chat_message", {
      p_conversation_id: params.data.id,
      p_role: body.data.role,
      p_content: body.data.content ?? null,
      p_parts: body.data.parts,
      p_model: body.data.model ?? null,
      p_input_tokens: body.data.inputTokens ?? null,
      p_output_tokens: body.data.outputTokens ?? null,
      p_metadata: body.data.metadata,
    }).single();
    if (error) {
      request.log.error({ error }, "Unable to append chat message");
      return reply.code(503).send({ error: "Unable to save message" });
    }
    return reply.code(201).send({ message: data });
  });
}
