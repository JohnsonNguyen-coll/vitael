// minimumFee is in basis points; forwardFee is in USDC atomic units.
export function calculateBridgeFee(amount: bigint, fee: { minimumFee: number; forwardFee?: { med?: number } }) {
  const med = fee.forwardFee?.med;
  if (amount <= 0n || !Number.isFinite(fee.minimumFee) || fee.minimumFee < 0 ||
      med === undefined || !Number.isSafeInteger(med) || med < 0) {
    throw new Error("Invalid or unavailable Circle forwarding fee");
  }
  const scaledBps = Math.ceil(fee.minimumFee * 10_000);
  if (!Number.isSafeInteger(scaledBps)) throw new Error("Invalid Circle fee rate");
  const protocolFee = (amount * BigInt(scaledBps) + 99_999_999n) / 100_000_000n;
  const forwardFee = BigInt(med);
  const maxFee = forwardFee + protocolFee;
  if (maxFee >= amount) throw new Error("Amount must exceed the bridge fee");
  return { forwardFee, protocolFee, maxFee };
}
