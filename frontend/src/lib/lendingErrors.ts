/** Custom-error selectors from pool, VitaelOracle, and Stork aggregator */
const REVERT_MESSAGES: Record<string, string> = {
  // VitaelLendingPool
  "0xbb55fd27":
    "The pool has no USDC liquidity. Supply USDC on the Lend page first, then try borrowing again.",
  "0x62e82dca":
    "This borrow would make your health factor too low. Borrow less or deposit more collateral.",
  "0x3a23d825": "Not enough collateral for this action.",
  "0x1f2a2005": "Amount must be greater than zero.",
  "0xb047cbb9": "This token is not supported as collateral.",
  // VitaelOracle
  "0x310376d7": "No price feed configured for this asset on the oracle.",
  "0x00bfc921": "Oracle price is invalid (zero or negative).",
  // Stork aggregator (used by StorkPriceFeed → borrow/HF reverts here)
  "0xc5723b51":
    "Stork has no on-chain price for USDC or EURC yet (error NotFound). USDC/EURC borrows need a price update on Arc Testnet — ask the protocol owner to push Stork prices or run script/PatchMissingStorkFeeds.s.sol on testnet.",
  "0x24c4fe43":
    "Stork price is stale. Update on-chain oracle prices, then retry.",
};

function extractRevertData(err: unknown): string | null {
  const seen = new Set<unknown>();
  let cur: unknown = err;
  while (cur != null && !seen.has(cur)) {
    seen.add(cur);
    if (typeof cur === "object") {
      const e = cur as Record<string, unknown>;
      if (typeof e.data === "string" && e.data.startsWith("0x")) return e.data;
      if (typeof e.signature === "string" && e.signature.startsWith("0x")) {
        return e.signature.length === 10 ? e.signature : null;
      }
      const msg = typeof e.message === "string" ? e.message : "";
      const m = msg.match(/0x[a-fA-F0-9]{8}/);
      if (m) return m[0];
      cur = e.cause;
    } else break;
  }
  return null;
}

function extractSelectorFromText(err: unknown): string | null {
  const parts: string[] = [];
  const seen = new Set<unknown>();
  let cur: unknown = err;
  while (cur != null && !seen.has(cur)) {
    seen.add(cur);
    if (typeof cur === "string") parts.push(cur);
    else if (typeof cur === "object") {
      const e = cur as Record<string, unknown>;
      if (typeof e.message === "string") parts.push(e.message);
      if (typeof e.shortMessage === "string") parts.push(e.shortMessage);
      cur = e.cause;
    } else break;
  }
  const m = parts.join(" ").match(/signature:\s*(0x[a-fA-F0-9]{8})/i)
    ?? parts.join(" ").match(/\b(0x[a-fA-F0-9]{8})\b/);
  return m ? m[1].toLowerCase() : null;
}

export function parseLendingPoolError(err: unknown): string | null {
  const data = extractRevertData(err);
  const selector = (data?.slice(0, 10) ?? extractSelectorFromText(err))?.toLowerCase();
  if (!selector) return null;
  return REVERT_MESSAGES[selector] ?? null;
}
