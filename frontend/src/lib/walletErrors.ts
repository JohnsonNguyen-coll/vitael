/** Normalize wallet / RPC errors for UI (incl. user reject in MetaMask, Rainbow, etc.). */

const REJECT_PATTERNS = [
  /user rejected/i,
  /user denied/i,
  /rejected the request/i,
  /request rejected/i,
  /action_rejected/i,
  /denied transaction/i,
  /transaction was rejected/i,
  /declined/i,
  /cancelled/i,
  /canceled/i,
];

function isRejectCode(part: string): boolean {
  if (part === "4001" || part === "ACTION_REJECTED") return true;
  const n = Number(part);
  return n === 4001;
}

function collectErrorParts(err: unknown): string[] {
  const parts: string[] = [];
  const seen = new Set<unknown>();
  let cur: unknown = err;

  while (cur != null && !seen.has(cur)) {
    seen.add(cur);
    if (typeof cur === "string") {
      parts.push(cur);
      break;
    }
    if (typeof cur === "object") {
      const e = cur as Record<string, unknown>;
      if (typeof e.message === "string") parts.push(e.message);
      if (typeof e.shortMessage === "string") parts.push(e.shortMessage);
      if (typeof e.details === "string") parts.push(e.details);
      if (typeof e.name === "string") parts.push(e.name);
      if (e.code !== undefined && e.code !== null) parts.push(String(e.code));
      cur = e.cause;
    } else {
      parts.push(String(cur));
      break;
    }
  }

  return parts;
}

function isUserRejection(parts: string[]): boolean {
  const combined = parts.join(" ");
  if (REJECT_PATTERNS.some((p) => p.test(combined))) return true;
  return parts.some((p) => isRejectCode(p));
}

function shortenMessage(msg: string, max = 200): string {
  const oneLine = msg.replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max)}…`;
}

export type WalletErrorResult = {
  message: string;
  /** User closed / rejected wallet prompt — not a protocol failure */
  cancelled: boolean;
};

export function parseWalletError(err: unknown): WalletErrorResult {
  if (err == null) {
    return { message: "Unknown error", cancelled: false };
  }

  const parts = collectErrorParts(err);

  if (isUserRejection(parts)) {
    const combined = parts.join(" ");
    if (/switch|chain|network/i.test(combined)) {
      return {
        message: "Network switch cancelled. Approve switching to Arc Testnet to continue.",
        cancelled: true,
      };
    }
    return {
      message: "Transaction cancelled in your wallet.",
      cancelled: true,
    };
  }

  const primary =
    parts.find((p) => p.length > 0 && !isRejectCode(p)) ??
    parts[0] ??
    "Transaction failed";

  return { message: shortenMessage(primary), cancelled: false };
}
