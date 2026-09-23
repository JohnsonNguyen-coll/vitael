import type { Address } from "viem";

/** Arc Mainnet tokens (same as Circle / Vitael DEX). */
export const ARC_TOKENS = {
  USDC: {
    address: (process.env.NEXT_PUBLIC_USDC ?? "0x3600000000000000000000000000000000000000") as Address,
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
  },
  EURC: {
    address: (process.env.NEXT_PUBLIC_EURC ?? "0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1") as Address,
    symbol: "EURC",
    name: "Euro Coin",
    decimals: 6,
  },
  cirBTC: {
    address: (process.env.NEXT_PUBLIC_CIRBTC ?? "0x171A4217b86A807A64eB94757Db6849fb4bDbAA0") as Address,
    symbol: "cirBTC",
    name: "Circle BTC",
    decimals: 8,
  },
} as const;

export type ArcTokenSymbol = keyof typeof ARC_TOKENS;

export const BRIDGE_URL = "/bridge";
