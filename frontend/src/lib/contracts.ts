import type { Address } from "viem";
import { ARC_TOKENS } from "./arcTokens";

/** Arc Testnet — Vitael Lending (from broadcast/DeployVitael.s.sol) */
export const LENDING_CONTRACTS = {
  LENDING_POOL: (process.env.NEXT_PUBLIC_LENDING_POOL ?? "") as Address,
  ORACLE:       (process.env.NEXT_PUBLIC_ORACLE       ?? "") as Address,
  USDC:         ARC_TOKENS.USDC.address,
  EURC:         ARC_TOKENS.EURC.address,
  CIRBTC:       ARC_TOKENS.cirBTC.address,
  STORK_AGGREGATOR: (process.env.NEXT_PUBLIC_STORK_AGGREGATOR ?? "0xacC0a0cF13571d30B4b8637996F5D6D774d4fd62") as Address,
} as const;

export const ARC_RPC = process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.testnet.arc.network";
export const ARC_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "5042002");

export function lendingConfigured(): boolean {
  return Boolean(LENDING_CONTRACTS.LENDING_POOL);
}
