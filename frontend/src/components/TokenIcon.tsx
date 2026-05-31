"use client";

import Image from "next/image";
import { useState } from "react";

// ─── Token logo sources ───────────────────────────────────────────────────────
// Primary: CoinGecko CDN (stable, widely used)
// Fallback: Trust Wallet assets on GitHub
const TOKEN_LOGOS: Record<string, { src: string; fallback: string; bg: string }> = {
  USDC: {
    src:      "https://assets.coingecko.com/coins/images/6319/small/usdc.png",
    fallback: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png",
    bg:       "#2775CA",
  },
  EURC: {
    src:      "https://assets.coingecko.com/coins/images/26045/small/euro-coin.png",
    fallback: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c/logo.png",
    bg:       "#0052B4",
  },
  WETH: {
    src:      "https://assets.coingecko.com/coins/images/2518/small/weth.png",
    fallback: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png",
    bg:       "#627EEA",
  },
  ETH: {
    src:      "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
    fallback: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png",
    bg:       "#627EEA",
  },
  WBTC: {
    src:      "https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png",
    fallback: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599/logo.png",
    bg:       "#F7931A",
  },
  BTC: {
    src:      "https://assets.coingecko.com/coins/images/1/small/bitcoin.png",
    fallback: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/bitcoin/info/logo.png",
    bg:       "#F7931A",
  },
  cirBTC: {
    src:      "https://assets.coingecko.com/coins/images/1/small/bitcoin.png",
    fallback: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/bitcoin/info/logo.png",
    bg:       "#F7931A",
  },
  USDT: {
    src:      "https://assets.coingecko.com/coins/images/325/small/Tether.png",
    fallback: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png",
    bg:       "#26A17B",
  },
  DAI: {
    src:      "https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png",
    fallback: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6B175474E89094C44Da98b954EedeAC495271d0F/logo.png",
    bg:       "#F5AC37",
  },
};

// Fallback letter avatar colors
const FALLBACK_COLORS: Record<string, string> = {
  U: "#2775CA", E: "#0052B4", W: "#627EEA", B: "#F7931A",
  D: "#F5AC37", T: "#26A17B", c: "#F7931A",
};

interface TokenIconProps {
  symbol: string;
  size?: number;
  className?: string;
  showBg?: boolean;
}

export default function TokenIcon({ symbol, size = 32, className = "", showBg = true }: TokenIconProps) {
  const [imgError, setImgError] = useState(false);
  const [useFallback, setUseFallback] = useState(false);

  const meta = TOKEN_LOGOS[symbol];
  const bgColor = meta?.bg ?? "#1a2a4a";
  const firstChar = symbol[0] ?? "?";
  const fallbackBg = FALLBACK_COLORS[firstChar] ?? "#1a2a4a";

  const imgSrc = !meta
    ? null
    : useFallback
    ? meta.fallback
    : meta.src;

  const containerStyle: React.CSSProperties = {
    width:  size,
    height: size,
    borderRadius: "50%",
    overflow: "hidden",
    flexShrink: 0,
    background: showBg ? (imgError ? fallbackBg : bgColor) : "transparent",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  if (!imgSrc || imgError) {
    // Letter avatar fallback
    return (
      <div style={{ ...containerStyle, background: fallbackBg }} className={className}>
        <span style={{ fontSize: size * 0.42, fontWeight: 700, color: "#fff", lineHeight: 1 }}>
          {symbol.slice(0, 2).toUpperCase()}
        </span>
      </div>
    );
  }

  return (
    <div style={containerStyle} className={className}>
      <Image
        src={imgSrc}
        alt={symbol}
        width={size}
        height={size}
        style={{ objectFit: "cover", width: "100%", height: "100%" }}
        onError={() => {
          if (!useFallback) {
            setUseFallback(true);
          } else {
            setImgError(true);
          }
        }}
        unoptimized
      />
    </div>
  );
}
