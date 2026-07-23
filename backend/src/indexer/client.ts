import { createPublicClient, defineChain, fallback, http } from "viem";
import { env } from "../config/env.js";

const arcTestnet = defineChain({
  id: env.ARC_CHAIN_ID,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [env.ARC_RPC_URL] } },
});

const urls = [env.ARC_RPC_URL, ...env.ARC_RPC_FALLBACK_URLS.split(",")]
  .map((url) => url.trim())
  .filter((url, index, all) => url.length > 0 && all.indexOf(url) === index);

export const arcClient = createPublicClient({
  chain: arcTestnet,
  transport: fallback(
    urls.map((url) => http(url, { batch: true, retryCount: 2, retryDelay: 500, timeout: 15_000 })),
    { rank: true, retryCount: 2, retryDelay: 750 },
  ),
  batch: { multicall: true },
});
