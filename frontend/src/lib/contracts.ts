import type { Address } from "viem";
import { ARC_TOKENS } from "./arcTokens";

/** Arc Mainnet — Vitael Lending (from broadcast/DeployVitael.s.sol) */
export const LENDING_CONTRACTS = {
  LENDING_POOL: (process.env.NEXT_PUBLIC_LENDING_POOL ?? "") as Address,
  ORACLE:       (process.env.NEXT_PUBLIC_ORACLE       ?? "") as Address,
  USDC:         ARC_TOKENS.USDC.address,
  EURC:         ARC_TOKENS.EURC.address,
  CIRBTC:       ARC_TOKENS.cirBTC.address,
} as const;

export const VAULT_CONTRACTS = {
  USDC_VAULT: (process.env.NEXT_PUBLIC_USDC_VAULT ?? "") as Address,
} as const;

export const ARC_RPC = process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.mainnet.arc.io";
export const ARC_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "5042");

export function lendingConfigured(): boolean {
  return Boolean(LENDING_CONTRACTS.LENDING_POOL);
}

export function vaultConfigured(): boolean {
  return Boolean(VAULT_CONTRACTS.USDC_VAULT);
}
