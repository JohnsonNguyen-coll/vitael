/** Stable number formatting for SSR + client (avoid locale hydration mismatch). */
const USD_FMT = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatUsd(n: number): string {
  if (Number.isNaN(n)) return "—";
  return `$${USD_FMT.format(n)}`;
}

export function formatTokenAmount(
  value: string | number,
  options?: { min?: number; max?: number },
): string {
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: options?.min ?? 2,
    maximumFractionDigits: options?.max ?? 2,
  }).format(n);
}
