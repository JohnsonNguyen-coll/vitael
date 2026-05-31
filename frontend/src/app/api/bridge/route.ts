import { NextRequest, NextResponse } from "next/server";
import { AppKit } from "@circle-fin/app-kit";
import { createViemAdapterFromPrivateKey } from "@circle-fin/adapter-viem-v2";

const kit = new AppKit();

// BigInt cannot be serialized by JSON.stringify — convert to string recursively
function serializeBigInt(obj: unknown): unknown {
  if (typeof obj === "bigint") return obj.toString();
  if (Array.isArray(obj)) return obj.map(serializeBigInt);
  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, serializeBigInt(v)])
    );
  }
  return obj;
}

export async function POST(req: NextRequest) {
  try {
    const { fromChain, toChain, amount } = await req.json();

    const privateKey = process.env.PRIVATE_KEY;

    if (!privateKey) {
      return NextResponse.json(
        { error: "Server not configured: missing PRIVATE_KEY" },
        { status: 500 }
      );
    }

    const adapter = createViemAdapterFromPrivateKey({
      privateKey: privateKey as `0x${string}`,
    });

    const result = await kit.bridge({
      from: { adapter, chain: fromChain },
      to:   { adapter, chain: toChain },
      amount,
    });

    return NextResponse.json(serializeBigInt(result));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
