import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { supabase } from "../lib/supabase.js";
import { positiveLimitSchema } from "../lib/validation.js";

const historyQuerySchema = z.object({
  chainId: z.coerce.number().int().positive().default(5042002),
  limit: positiveLimitSchema.default(30),
  before: z.string().datetime().optional(),
});

export async function protocolRoutes(app: FastifyInstance) {
  app.get("/protocol/indexer-status", async (_request, reply) => {
    const { data, error } = await supabase.from("indexer_state")
      .select("worker_key,chain_id,last_processed_block,last_processed_block_hash,status,error_message,updated_at")
      .order("updated_at", { ascending: false });
    if (error) return reply.code(503).send({ error: "Unable to load indexer status" });
    return { workers: data };
  });

  app.get("/protocol/stats", async (request, reply) => {
    const query = z.object({ chainId: z.coerce.number().int().positive().default(5042002) }).safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: "Invalid chain ID" });

    const { data, error } = await supabase.from("protocol_snapshots")
      .select("chain_id,block_number,tvl_usd,total_supplied_usd,total_borrowed_usd,swap_volume_usd,utilization,markets,captured_at")
      .eq("chain_id", query.data.chainId).order("captured_at", { ascending: false }).limit(1).maybeSingle();
    if (error) return reply.code(503).send({ error: "Unable to load protocol stats" });
    return { stats: data };
  });

  app.get("/protocol/history", async (request, reply) => {
    const query = historyQuerySchema.safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: "Invalid history query" });

    let builder = supabase.from("protocol_snapshots")
      .select("chain_id,block_number,tvl_usd,total_supplied_usd,total_borrowed_usd,swap_volume_usd,utilization,markets,captured_at")
      .eq("chain_id", query.data.chainId)
      .order("captured_at", { ascending: false })
      .limit(query.data.limit);
    if (query.data.before) builder = builder.lt("captured_at", query.data.before);

    const { data, error } = await builder;
    if (error) return reply.code(503).send({ error: "Unable to load protocol history" });
    return { items: data.reverse() };
  });
}
