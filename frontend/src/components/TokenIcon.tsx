"use client";

import Image from "next/image";
import { useState } from "react";

// ─── Token logo map ───────────────────────────────────────────────────────────
// Using direct, stable CDN URLs verified to work
const TOKEN_LOGOS: Record<string, { src: string; bg: string }> = {
  USDC: {
    // Official Circle USDC logo via CoinGecko (large ID 6319)
    src: "https://assets.coingecko.com/coins/images/6319/large/usdc.png",
    bg:  "#2775CA",
  },
  EURC: {
    src: "https://assets.coingecko.com/coins/images/26045/large/euro-coin.png",
    bg:  "#0052B4",
  },
  WETH: {
    src: "https://assets.coingecko.com/coins/images/2518/large/weth.png",
    bg:  "#627EEA",
  },
  ETH: {
    src: "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
    bg:  "#627EEA",
  },
  WBTC: {
    src: "https://assets.coingecko.com/coins/images/7598/large/wrapped_bitcoin_wbtc.png",
    bg:  "#F7931A",
  },
  BTC: {
    src: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png",
    bg:  "#F7931A",
  },
  cirBTC: {
    src: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png",
    bg:  "#F7931A",
  },
  USDT: {
    src: "https://assets.coingecko.com/coins/images/325/large/Tether.png",
    bg:  "#26A17B",
  },
  DAI: {
    src: "https://assets.coingecko.com/coins/images/9956/large/Badge_Dai.png",
    bg:  "#F5AC37",
  },
};

// Letter avatar fallback colors per first char
const LETTER_COLORS: Record<string, string> = {
  U: "#2775CA", E: "#0052B4", W: "#627EEA",
  B: "#F7931A", D: "#F5AC37", T: "#26A17B", c: "#F7931A",
};

interface TokenIconProps {
  symbol: string;
  size?: number;
  className?: string;
}

export default function TokenIcon({ symbol, size = 32, className = "" }: TokenIconProps) {
  const [error, setError] = useState(false);

  const meta = TOKEN_LOGOS[symbol];
  const bg   = meta?.bg ?? LETTER_COLORS[symbol[0]] ?? "#1a2a4a";

  const style: React.CSSProperties = {
    width: size, height: size,
    borderRadius: "50%",
    overflow: "hidden",
    flexShrink: 0,
    background: bg,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  if (!meta || error) {
    return (
      <div style={style} className={className}>
        <span style={{ fontSize: size * 0.42, fontWeight: 700, color: "#fff", lineHeight: 1 }}>
          {symbol.slice(0, 2).toUpperCase()}
        </span>
      </div>
    );
  }

  return (
    <div style={style} className={className}>
      <Image
        src={meta.src}
        alt={symbol}
        width={size}
        height={size}
        style={{ objectFit: "cover", width: "100%", height: "100%" }}
        onError={() => setError(true)}
        unoptimized
      />
    </div>
  );
}
