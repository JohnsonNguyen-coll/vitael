import { toFunctionSelector } from "viem";

/** Custom-error selectors from pool, VitaelOracle, and Stork aggregator */
const REVERT_MESSAGES: Record<string, string> = {
  [toFunctionSelector("BorrowLimitExceeded()")]: "This action exceeds your borrowing limit. Borrow or withdraw less, or add collateral.",
  [toFunctionSelector("ZeroShares()")]: "This amount is too small to create or redeem shares. Increase the amount.",
  [toFunctionSelector("NoLiquidatableCollateral()")]: "There is no available collateral of the selected asset to liquidate.",
  [toFunctionSelector("LiquidationTooSmall()")]: "This liquidation amount is too small to exchange for collateral.",
  [toFunctionSelector("ExceedsCloseFactor()")]: "The requested liquidation exceeds the permitted portion of the debt.",
  [toFunctionSelector("PositionHealthy()")]: "This position is healthy and cannot be liquidated.",
  [toFunctionSelector("UnsupportedTransfer()")]: "This token transfer did not deliver the expected amount.",
  [toFunctionSelector("InvalidAssetConfiguration()")]: "This market configuration is invalid. Try again after it is corrected.",
  [toFunctionSelector("StalePrice(address)")]: "The price for this asset has expired. Try again after its price feed updates.",
  [toFunctionSelector("InvalidPriceTimestamp()")]: "The price feed timestamp is invalid. Try again after the feed is corrected.",
  [toFunctionSelector("IncompleteRound()")]: "The price feed update is incomplete. Please try again later.",
  [toFunctionSelector("InvalidFeedConfiguration()")]: "The price feed configuration is invalid. Please try again later.",
  [toFunctionSelector("AssetPriceNotSet(address)")]: "No price feed is configured for this asset.",
  [toFunctionSelector("InvalidPrice()")]: "The price feed returned an invalid price.",
  [toFunctionSelector("InsufficientLiquidity()")]: "The pool does not have enough available liquidity for this action.",
  // VitaelLendingPool
  "0xbb55fd27":
    "The pool does not have enough available liquidity for this action.",
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
    "A price is currently unavailable for this asset. Please try again after the feed updates.",
  "0x24c4fe43":
    "Oracle price is stale. Retry after a fresh price is available.",
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
