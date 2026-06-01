import { createPublicClient, http, type Address } from "viem";
import { arcTestnet } from "../app/providers";
import { LENDING_CONTRACTS, ARC_RPC } from "./contracts";

const client = createPublicClient({ chain: arcTestnet, transport: http(ARC_RPC) });

const ORACLE_ABI = [
  {
    type: "function",
    name: "getAssetPrice",
    stateMutability: "view",
    inputs: [{ name: "asset", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

export type OracleAssetStatus = {
  symbol: string;
  address: Address;
  ok: boolean;
};

/** Returns which VitaelOracle assets currently return a price (borrow needs USDC + collateral feeds). */
export async function checkOracleFeeds(): Promise<OracleAssetStatus[]> {
  const oracle = LENDING_CONTRACTS.ORACLE;
  if (!oracle) return [];

  const assets: { symbol: string; address: Address }[] = [
    { symbol: "USDC", address: LENDING_CONTRACTS.USDC },
    { symbol: "EURC", address: LENDING_CONTRACTS.EURC },
    { symbol: "cirBTC", address: LENDING_CONTRACTS.CIRBTC },
  ];

  return Promise.all(
    assets.map(async ({ symbol, address }) => {
      if (!address) return { symbol, address: "0x0" as Address, ok: false };
      try {
        const price = await client.readContract({
          address: oracle,
          abi: ORACLE_ABI,
          functionName: "getAssetPrice",
          args: [address],
        });
        return { symbol, address, ok: price > 0n };
      } catch {
        return { symbol, address, ok: false };
      }
    }),
  );
}

export function oracleReadyForBorrow(status: OracleAssetStatus[]): boolean {
  const usdc = status.find((s) => s.symbol === "USDC");
  return Boolean(usdc?.ok);
}
