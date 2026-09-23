import { z } from "zod";
import type { Address } from "viem";

const address = z.string()
  .regex(/^0x[0-9a-fA-F]{40}$/, "Expected a 20-byte hex address")
  .refine((value) => !/^0x0{40}$/.test(value), "Zero address is not allowed")
  .transform((value) => value as Address);

// Loaded by the indexer only; the HTTP API does not require these settings.
const parsed = z.object({
  LENDING_POOL: address,
  ORACLE: address,
  DEX_FACTORY: address,
  CCTP_TOKEN_MESSENGER: address,
  CCTP_MESSAGE_TRANSMITTER: address,
  USDC_ADDRESS: address,
  EURC_ADDRESS: address,
  CIRBTC_ADDRESS: address,
}).safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid indexer addresses", parsed.error.flatten().fieldErrors);
  throw new Error("Indexer address configuration failed");
}

export const indexerEnv = parsed.data;
