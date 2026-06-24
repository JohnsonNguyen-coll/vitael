import { NextRequest, NextResponse } from "next/server";
import { encodeFunctionData } from "viem";

const ROUTER_ABI = [{
  "inputs": [
    {"name":"amountIn","type":"uint256"},
    {"name":"amountOutMin","type":"uint256"},
    {"name":"path","type":"address[]"},
    {"name":"to","type":"address"},
    {"name":"deadline","type":"uint256"}
  ],
  "name": "swapExactTokensForTokens",
  "outputs": [{"name":"amounts","type":"uint256[]"}],
  "stateMutability": "nonpayable",
  "type": "function"
}] as const;

export async function POST(req: NextRequest) {
  try {
    const { tokenIn, tokenOut, amountIn, userAddress } = await req.json();

    if (!userAddress) {
      return NextResponse.json({ error: "Missing userAddress" }, { status: 400 });
    }

    const routerAddress = process.env.NEXT_PUBLIC_DEX_ROUTER || process.env.DEX_ROUTER;
    if (!routerAddress) {
      return NextResponse.json({ error: "Server missing DEX_ROUTER config" }, { status: 500 });
    }

    // Default deadline 30 mins
    const deadline = Math.floor(Date.now() / 1000) + 1800;
    
    // Exact path
    const path = [tokenIn, tokenOut];
    
    // We set amountOutMin to 0 for simplicity in this demo, or we could accept it from frontend
    const amountOutMin = "0";

    const data = encodeFunctionData({
      abi: ROUTER_ABI,
      functionName: 'swapExactTokensForTokens',
      args: [BigInt(amountIn), BigInt(amountOutMin), path as `0x${string}`[], userAddress as `0x${string}`, BigInt(deadline)]
    });

    return NextResponse.json({
      unsignedTx: {
        to: routerAddress,
        data,
        value: "0"
      }
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

