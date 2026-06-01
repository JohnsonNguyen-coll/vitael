import type { Address } from "viem";

/** Arc Testnet — Vitael Lending (from broadcast/DeployVitael.s.sol) */
export const LENDING_CONTRACTS = {
  LENDING_POOL: (process.env.NEXT_PUBLIC_LENDING_POOL ?? "") as Address,
  VUSDC:        (process.env.NEXT_PUBLIC_VUSDC        ?? "") as Address,
  ORACLE:       (process.env.NEXT_PUBLIC_ORACLE       ?? "") as Address,
  USDC:         (process.env.NEXT_PUBLIC_USDC ?? "0x3600000000000000000000000000000000000000") as Address,
  WETH:         (process.env.NEXT_PUBLIC_WETH ?? "") as Address,
  WBTC:         (process.env.NEXT_PUBLIC_WBTC ?? "") as Address,
} as const;

export const ARC_RPC = process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.testnet.arc.network";
export const ARC_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "5042002");

export function lendingConfigured(): boolean {
  return Boolean(LENDING_CONTRACTS.LENDING_POOL && LENDING_CONTRACTS.VUSDC);
}
