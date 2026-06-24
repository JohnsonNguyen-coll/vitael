import { NextRequest, NextResponse } from "next/server";
import { encodeFunctionData, pad } from "viem";

const BRIDGE_ABI = [
  {
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "destinationDomain", type: "uint32" },
      { name: "mintRecipient", type: "bytes32" },
      { name: "burnToken", type: "address" }
    ],
    name: "depositForBurn",
    outputs: [{ name: "nonce", type: "uint64" }],
    stateMutability: "nonpayable",
    type: "function",
  }
] as const;

export async function POST(req: NextRequest) {
  try {
    const { amount, destinationDomain, burnToken, userAddress } = await req.json();

    if (!userAddress) {
      return NextResponse.json({ error: "Missing userAddress" }, { status: 400 });
    }

    const bridgeAddress = process.env.BRIDGE || "0x0000000000000000000000000000000000000003";

    // Format mintRecipient to bytes32 (padded address)
    const mintRecipient = pad(userAddress as `0x${string}`);

    const data = encodeFunctionData({
      abi: BRIDGE_ABI,
      functionName: 'depositForBurn',
      args: [BigInt(amount), destinationDomain, mintRecipient, burnToken as `0x${string}`]
    });

    return NextResponse.json({
      unsignedTx: {
        to: bridgeAddress,
        data,
        value: "0"
      }
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

