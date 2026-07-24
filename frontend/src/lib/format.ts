/** Locale-independent decimal formatting (SSR-safe, no Intl locale drift). */
function formatDecimalEn(n: number, minFrac: number, maxFrac: number): string {
  if (!Number.isFinite(n)) return "—";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const [intPart, decRaw = ""] = abs.toFixed(maxFrac).split(".");
  const withGroups = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (maxFrac === 0) return `${sign}${withGroups}`;
  const dec = decRaw.replace(/0+$/, "").padEnd(minFrac, "0");
  return dec ? `${sign}${withGroups}.${dec}` : `${sign}${withGroups}`;
}

export function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `$${formatDecimalEn(n, 2, 2)}`;
}

export function formatTokenAmount(
  value: string | number,
  options?: { min?: number; max?: number },
): string {
  const n = typeof value === "string" ? parseFloat(value) : value;
  const min = options?.min ?? 2;
  const max = options?.max ?? 2;
  return formatDecimalEn(n, min, max);
}
