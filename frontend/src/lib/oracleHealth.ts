import { createPublicClient, http, type Address } from "viem";
import { arcTestnet } from "../app/providers";
import { LENDING_CONTRACTS, ARC_RPC } from "./contracts";

const client = createPublicClient({
  chain: arcTestnet,
  transport: http(ARC_RPC, { retryCount: 4, retryDelay: 400 }),
});

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
  /** An RPC failure is not evidence that the on-chain feed is missing. */
  error?: "feed" | "rpc" | "config";
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isRpcFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /request limit|rate limit|rpc request failed|http request failed|network error|timeout/i.test(message);
}

/** Returns which VitaelOracle assets currently return a price (borrow needs USDC + collateral feeds). */
export async function checkOracleFeeds(): Promise<OracleAssetStatus[]> {
  const oracle = LENDING_CONTRACTS.ORACLE;
  if (!oracle) return [];

  const assets: { symbol: string; address: Address }[] = [
    { symbol: "USDC", address: LENDING_CONTRACTS.USDC },
    { symbol: "EURC", address: LENDING_CONTRACTS.EURC },
    { symbol: "cirBTC", address: LENDING_CONTRACTS.CIRBTC },
  ];

  const status: OracleAssetStatus[] = [];

  // Query serially: Arc's public RPC rate-limits concurrent eth_call requests.
  for (const { symbol, address } of assets) {
    if (!address) {
      status.push({ symbol, address: "0x0" as Address, ok: false, error: "config" });
      continue;
    }

    let rpcFailure = false;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const price = await client.readContract({
          address: oracle,
          abi: ORACLE_ABI,
          functionName: "getAssetPrice",
          args: [address],
        });
        status.push({ symbol, address, ok: price > 0n, error: price > 0n ? undefined : "feed" });
        rpcFailure = false;
        break;
      } catch (error) {
        rpcFailure = isRpcFailure(error);
        if (!rpcFailure || attempt === 2) {
          status.push({ symbol, address, ok: false, error: rpcFailure ? "rpc" : "feed" });
          break;
        }
        await delay(500 * (attempt + 1));
      }
    }
  }

  return status;
}

export function oracleReadyForBorrow(status: OracleAssetStatus[]): boolean {
  const usdc = status.find((s) => s.symbol === "USDC");
  return Boolean(usdc?.ok);
}
