import type { Address } from "viem";

/** Arc Testnet tokens (same as Circle / Vitael DEX). */
export const ARC_TOKENS = {
  USDC: {
    address: (process.env.NEXT_PUBLIC_USDC ?? "0x3600000000000000000000000000000000000000") as Address,
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
  },
  EURC: {
    address: (process.env.NEXT_PUBLIC_EURC ?? "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a") as Address,
    symbol: "EURC",
    name: "Euro Coin",
    decimals: 6,
  },
  cirBTC: {
    address: (process.env.NEXT_PUBLIC_CIRBTC ?? "0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF") as Address,
    symbol: "cirBTC",
    name: "Circle BTC",
    decimals: 8,
  },
} as const;

export type ArcTokenSymbol = keyof typeof ARC_TOKENS;

export const CIRCLE_FAUCET_URL = "https://faucet.circle.com/";
