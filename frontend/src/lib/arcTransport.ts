import { fallback, http } from "viem";

const PRIMARY_ARC_RPC = process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.mainnet.arc.io";

if (process.env.NEXT_PUBLIC_CHAIN_ID && process.env.NEXT_PUBLIC_CHAIN_ID !== "5042") throw new Error("Expected Arc mainnet chain 5042");
if (/testnet|sepolia/i.test(PRIMARY_ARC_RPC)) throw new Error("Arc RPC must use mainnet");

/** Official Arc Mainnet RPC endpoints, ordered by preference. */
export const ARC_RPC_URLS = [
  PRIMARY_ARC_RPC,
  "https://rpc.blockdaemon.mainnet.arc.io",
  "https://rpc.drpc.mainnet.arc.io",
  "https://rpc.quicknode.mainnet.arc.io",
].filter((url, index, urls) => urls.indexOf(url) === index);

/** Automatically falls back when an Arc endpoint is rate-limited or offline. */
export function arcTransport() {
  return fallback(
    ARC_RPC_URLS.map(url => http(url, {
      batch: true,
      retryCount: 1,
      retryDelay: 400,
      timeout: 12_000,
    })),
  );
}
