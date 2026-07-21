import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { supabase } from "../lib/supabase.js";
import { sanitizedFileExtension, walletAddressSchema } from "../lib/validation.js";

const paramsSchema = z.object({ walletAddress: walletAddressSchema });
const profileBodySchema = z.object({
  displayName: z.string().trim().min(1).max(48).nullable().optional(),
  bio: z.string().trim().max(280).nullable().optional(),
  preferences: z.record(z.string(), z.unknown()).optional(),
});

const profileColumns = "wallet_address,display_name,bio,avatar_path,preferences,created_at,updated_at";

export async function profileRoutes(app: FastifyInstance) {
  app.get("/profiles/:walletAddress", async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "Invalid wallet address" });

    const { data, error } = await supabase
      .from("profiles")
      .select(profileColumns)
      .eq("wallet_address", params.data.walletAddress)
      .maybeSingle();

    if (error) return reply.code(503).send({ error: "Unable to load profile" });
    if (!data) return reply.code(404).send({ error: "Profile not found" });

    const avatarUrl = data.avatar_path
      ? supabase.storage.from("avatars").getPublicUrl(data.avatar_path).data.publicUrl
      : null;
    return { profile: { ...data, avatar_url: avatarUrl } };
  });

  app.put("/profiles/:walletAddress", {
    config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    const body = profileBodySchema.safeParse(request.body);
    if (!params.success || !body.success) return reply.code(400).send({ error: "Invalid profile payload" });

    const row = {
      wallet_address: params.data.walletAddress,
      ...(body.data.displayName !== undefined && { display_name: body.data.displayName }),
      ...(body.data.bio !== undefined && { bio: body.data.bio }),
      ...(body.data.preferences !== undefined && { preferences: body.data.preferences }),
    };
    const { data, error } = await supabase
      .from("profiles")
      .upsert(row, { onConflict: "wallet_address" })
      .select(profileColumns)
      .single();

    if (error) {
      request.log.error({ error }, "Unable to update profile");
      return reply.code(503).send({ error: "Unable to update profile" });
    }
    return { profile: data };
  });

  app.post("/profiles/:walletAddress/avatar", {
    config: { rateLimit: { max: 10, timeWindow: "1 hour" } },
  }, async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "Invalid wallet address" });

    const file = await request.file({ limits: { files: 1, fileSize: 2 * 1024 * 1024 } });
    if (!file) return reply.code(400).send({ error: "Avatar file is required" });
    const extension = sanitizedFileExtension(file.mimetype);
    if (!extension) return reply.code(415).send({ error: "Only JPG, PNG, and WebP images are allowed" });

    const buffer = await file.toBuffer();
    const newPath = `${params.data.walletAddress}/${randomUUID()}.${extension}`;

    const { data: existing } = await supabase
      .from("profiles")
      .select("avatar_path")
      .eq("wallet_address", params.data.walletAddress)
      .maybeSingle();

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(newPath, buffer, { contentType: file.mimetype, upsert: false });
    if (uploadError) return reply.code(503).send({ error: "Unable to upload avatar" });

    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({ wallet_address: params.data.walletAddress, avatar_path: newPath }, { onConflict: "wallet_address" });
    if (profileError) {
      await supabase.storage.from("avatars").remove([newPath]);
      return reply.code(503).send({ error: "Unable to save avatar" });
    }

    if (existing?.avatar_path) await supabase.storage.from("avatars").remove([existing.avatar_path]);
    const publicUrl = supabase.storage.from("avatars").getPublicUrl(newPath).data.publicUrl;
    return { avatarPath: newPath, avatarUrl: publicUrl };
  });
}
