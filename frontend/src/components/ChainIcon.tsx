"use client";

import Image from "next/image";
import { useState } from "react";

// ─── Chain logo sources ───────────────────────────────────────────────────────
// Using Chainlist / official sources
const CHAIN_LOGOS: Record<string, { src: string; fallback: string; bg: string; name: string }> = {
  // Arc Testnet — dùng logo Circle vì Arc là của Circle
  Arc_Testnet: {
    src:      "https://assets.coingecko.com/coins/images/6319/small/usdc.png",
    fallback: "https://www.circle.com/hubfs/Brand/Circle-icon-blue.png",
    bg:       "#00F5FF",
    name:     "Arc Testnet",
  },
  Ethereum: {
    src:      "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
    fallback: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png",
    bg:       "#627EEA",
    name:     "Ethereum",
  },
  Ethereum_Sepolia: {
    src:      "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
    fallback: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png",
    bg:       "#627EEA",
    name:     "Ethereum Sepolia",
  },
  Arbitrum: {
    src:      "https://assets.coingecko.com/coins/images/16547/small/photo_2023-03-29_21.47.00.jpeg",
    fallback: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png",
    bg:       "#28A0F0",
    name:     "Arbitrum",
  },
  Arbitrum_Sepolia: {
    src:      "https://assets.coingecko.com/coins/images/16547/small/photo_2023-03-29_21.47.00.jpeg",
    fallback: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png",
    bg:       "#28A0F0",
    name:     "Arbitrum Sepolia",
  },
  Base: {
    src:      "https://assets.coingecko.com/asset_platforms/images/131/small/base-network.png",
    fallback: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png",
    bg:       "#0052FF",
    name:     "Base",
  },
  Base_Sepolia: {
    src:      "https://assets.coingecko.com/asset_platforms/images/131/small/base-network.png",
    fallback: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png",
    bg:       "#0052FF",
    name:     "Base Sepolia",
  },
  Polygon: {
    src:      "https://assets.coingecko.com/coins/images/4713/small/polygon.png",
    fallback: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png",
    bg:       "#8247E5",
    name:     "Polygon",
  },
  Polygon_Amoy_Testnet: {
    src:      "https://assets.coingecko.com/coins/images/4713/small/polygon.png",
    fallback: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png",
    bg:       "#8247E5",
    name:     "Polygon Amoy",
  },
  Avalanche: {
    src:      "https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png",
    fallback: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchec/info/logo.png",
    bg:       "#E84142",
    name:     "Avalanche",
  },
  Avalanche_Fuji: {
    src:      "https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png",
    fallback: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchec/info/logo.png",
    bg:       "#E84142",
    name:     "Avalanche Fuji",
  },
  Optimism: {
    src:      "https://assets.coingecko.com/coins/images/25244/small/Optimism.png",
    fallback: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/optimism/info/logo.png",
    bg:       "#FF0420",
    name:     "OP Mainnet",
  },
  OP_Sepolia: {
    src:      "https://assets.coingecko.com/coins/images/25244/small/Optimism.png",
    fallback: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/optimism/info/logo.png",
    bg:       "#FF0420",
    name:     "OP Sepolia",
  },
  Solana: {
    src:      "https://assets.coingecko.com/coins/images/4128/small/solana.png",
    fallback: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png",
    bg:       "#9945FF",
    name:     "Solana",
  },
  Solana_Devnet: {
    src:      "https://assets.coingecko.com/coins/images/4128/small/solana.png",
    fallback: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png",
    bg:       "#9945FF",
    name:     "Solana Devnet",
  },
};

interface ChainIconProps {
  chainId: string;   // App Kit chain identifier e.g. "Arc_Testnet"
  size?: number;
  className?: string;
  showRing?: boolean;
}

export default function ChainIcon({ chainId, size = 32, className = "", showRing = false }: ChainIconProps) {
  const [imgError, setImgError]     = useState(false);
  const [useFallback, setUseFallback] = useState(false);

  const meta = CHAIN_LOGOS[chainId];
  const bgColor = meta?.bg ?? "#1a2a4a";

  const imgSrc = !meta
    ? null
    : useFallback
    ? meta.fallback
    : meta.src;

  const ringStyle = showRing
    ? { boxShadow: `0 0 0 2px ${bgColor}40, 0 0 8px ${bgColor}30` }
    : {};

  const containerStyle: React.CSSProperties = {
    width:  size,
    height: size,
    borderRadius: "50%",
    overflow: "hidden",
    flexShrink: 0,
    background: bgColor,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    ...ringStyle,
  };

  if (!imgSrc || imgError) {
    const label = (meta?.name ?? chainId).slice(0, 2).toUpperCase();
    return (
      <div style={{ ...containerStyle, background: bgColor }} className={className}>
        <span style={{ fontSize: size * 0.38, fontWeight: 700, color: "#fff", lineHeight: 1 }}>
          {label}
        </span>
      </div>
    );
  }

  return (
    <div style={containerStyle} className={className}>
      <Image
        src={imgSrc}
        alt={meta?.name ?? chainId}
        width={size}
        height={size}
        style={{ objectFit: "cover", width: "100%", height: "100%" }}
        onError={() => {
          if (!useFallback) setUseFallback(true);
          else setImgError(true);
        }}
        unoptimized
      />
    </div>
  );
}
