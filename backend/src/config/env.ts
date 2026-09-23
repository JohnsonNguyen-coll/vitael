import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3001),
  FRONTEND_URL: z.string().url(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SECRET_KEY: z.string().min(20),
  ARC_RPC_URL: z.string().url().default("https://rpc.mainnet.arc.io"),
  ARC_RPC_FALLBACK_URLS: z.string().default("https://rpc.blockdaemon.mainnet.arc.io,https://rpc.drpc.mainnet.arc.io,https://rpc.quicknode.mainnet.arc.io"),
  ARC_CHAIN_ID: z.coerce.number().int().positive().refine(v => v === 5042, "Expected Arc mainnet chain 5042").default(5042),
  INDEXER_START_BLOCK: z.coerce.number().int().nonnegative().default(22332057),
  INDEXER_CONFIRMATIONS: z.coerce.number().int().min(1).default(3),
  INDEXER_BLOCK_CHUNK: z.coerce.number().int().min(10).max(5000).default(5000),
  INDEXER_LIVE_LOOKBACK_BLOCKS: z.coerce.number().int().min(100).max(100000).default(5000),
  INDEXER_POLL_INTERVAL_MS: z.coerce.number().int().min(1000).default(6000),
  SNAPSHOT_INTERVAL_MS: z.coerce.number().int().min(60000).default(300000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid backend environment", parsed.error.flatten().fieldErrors);
  throw new Error("Backend environment validation failed");
}

export const env = parsed.data;
