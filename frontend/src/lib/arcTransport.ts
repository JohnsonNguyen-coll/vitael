import { fallback, http } from "viem";

const PRIMARY_ARC_RPC = process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.testnet.arc.network";

/** Official Arc Testnet RPC endpoints, ordered by preference. */
export const ARC_RPC_URLS = [
  PRIMARY_ARC_RPC,
  "https://rpc.blockdaemon.testnet.arc.network",
  "https://rpc.drpc.testnet.arc.network",
  "https://rpc.quicknode.testnet.arc.network",
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
