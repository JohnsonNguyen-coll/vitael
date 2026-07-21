import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { supabase } from "../lib/supabase.js";
import { positiveLimitSchema, walletAddressSchema } from "../lib/validation.js";

const actions = [
  "supply", "withdraw", "deposit_collateral", "withdraw_collateral", "borrow", "repay",
  "liquidate", "swap", "add_liquidity", "remove_liquidity", "bridge",
] as const;
const querySchema = z.object({
  limit: positiveLimitSchema,
  cursor: z.coerce.number().int().positive().optional(),
  action: z.enum(actions).optional(),
});
const paramsSchema = z.object({ walletAddress: walletAddressSchema });

export async function transactionRoutes(app: FastifyInstance) {
  app.get("/transactions/:walletAddress", async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    const query = querySchema.safeParse(request.query);
    if (!params.success || !query.success) return reply.code(400).send({ error: "Invalid transaction query" });

    let builder = supabase.from("transactions")
      .select("id,chain_id,transaction_hash,log_index,wallet_address,contract_address,action,token_in,token_out,amount_in,amount_out,amount_in_decimals,amount_out_decimals,status,block_number,block_timestamp,metadata")
      .eq("wallet_address", params.data.walletAddress)
      .order("id", { ascending: false })
      .limit(query.data.limit + 1);
    if (query.data.cursor) builder = builder.lt("id", query.data.cursor);
    if (query.data.action) builder = builder.eq("action", query.data.action);

    const { data, error } = await builder;
    if (error) return reply.code(503).send({ error: "Unable to load transactions" });
    const hasMore = data.length > query.data.limit;
    const items = hasMore ? data.slice(0, query.data.limit) : data;
    return { items, nextCursor: hasMore ? items.at(-1)?.id ?? null : null };
  });
}
