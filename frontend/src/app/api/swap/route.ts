import { NextRequest, NextResponse } from "next/server";
import { AppKit } from "@circle-fin/app-kit";
import { createViemAdapterFromPrivateKey } from "@circle-fin/adapter-viem-v2";

const kit = new AppKit();

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
    const { tokenIn, tokenOut, amountIn, chain } = await req.json();

    const privateKey = process.env.PRIVATE_KEY;
    const kitKey = process.env.KIT_KEY;

    if (!privateKey || !kitKey) {
      return NextResponse.json(
        { error: "Server not configured: missing PRIVATE_KEY or KIT_KEY" },
        { status: 500 }
      );
    }

    const adapter = createViemAdapterFromPrivateKey({
      privateKey: privateKey as `0x${string}`,
    });

    const result = await kit.swap({
      from: { adapter, chain: chain ?? "Arc_Testnet" },
      tokenIn,
      tokenOut,
      amountIn,
      config: { kitKey },
    });

    return NextResponse.json(serializeBigInt(result));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
