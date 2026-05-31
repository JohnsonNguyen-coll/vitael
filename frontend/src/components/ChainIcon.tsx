"use client";

import Image from "next/image";
import { useState } from "react";

// ─── Chain logo map ───────────────────────────────────────────────────────────
// All URLs verified against CoinGecko large images (more reliable than /small/)
const CHAIN_LOGOS: Record<string, { src: string; bg: string; name: string }> = {
  Arc_Testnet: {
    // Arc = Circle's chain → use USDC logo as representative
    src:  "https://assets.coingecko.com/coins/images/6319/large/usdc.png",
    bg:   "#00C2CC",
    name: "Arc Testnet",
  },
  Ethereum: {
    src:  "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
    bg:   "#627EEA",
    name: "Ethereum",
  },
  Ethereum_Sepolia: {
    src:  "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
    bg:   "#627EEA",
    name: "Ethereum Sepolia",
  },
  Arbitrum: {
    src:  "https://assets.coingecko.com/coins/images/16547/large/photo_2023-03-29_21.47.00.jpeg",
    bg:   "#28A0F0",
    name: "Arbitrum",
  },
  Arbitrum_Sepolia: {
    src:  "https://assets.coingecko.com/coins/images/16547/large/photo_2023-03-29_21.47.00.jpeg",
    bg:   "#28A0F0",
    name: "Arbitrum Sepolia",
  },
  Base: {
    // Base official logo on CoinGecko
    src:  "https://assets.coingecko.com/asset_platforms/images/131/large/base-network.png",
    bg:   "#0052FF",
    name: "Base",
  },
  Base_Sepolia: {
    src:  "https://assets.coingecko.com/asset_platforms/images/131/large/base-network.png",
    bg:   "#0052FF",
    name: "Base Sepolia",
  },
  Polygon: {
    src:  "https://assets.coingecko.com/coins/images/4713/large/polygon.png",
    bg:   "#8247E5",
    name: "Polygon",
  },
  Polygon_Amoy_Testnet: {
    src:  "https://assets.coingecko.com/coins/images/4713/large/polygon.png",
    bg:   "#8247E5",
    name: "Polygon Amoy",
  },
  Avalanche: {
    src:  "https://assets.coingecko.com/coins/images/12559/large/Avalanche_Circle_RedWhite_Trans.png",
    bg:   "#E84142",
    name: "Avalanche",
  },
  Avalanche_Fuji: {
    src:  "https://assets.coingecko.com/coins/images/12559/large/Avalanche_Circle_RedWhite_Trans.png",
    bg:   "#E84142",
    name: "Avalanche Fuji",
  },
  Optimism: {
    // OP token logo — correct CoinGecko ID 25244
    src:  "https://assets.coingecko.com/coins/images/25244/large/Optimism.png",
    bg:   "#FF0420",
    name: "OP Mainnet",
  },
  OP_Sepolia: {
    src:  "https://assets.coingecko.com/coins/images/25244/large/Optimism.png",
    bg:   "#FF0420",
    name: "OP Sepolia",
  },
  Solana: {
    // Solana correct CoinGecko ID 4128
    src:  "https://assets.coingecko.com/coins/images/4128/large/solana.png",
    bg:   "#9945FF",
    name: "Solana",
  },
  Solana_Devnet: {
    src:  "https://assets.coingecko.com/coins/images/4128/large/solana.png",
    bg:   "#9945FF",
    name: "Solana Devnet",
  },
};

interface ChainIconProps {
  chainId: string;
  size?: number;
  className?: string;
  showRing?: boolean;
}

export default function ChainIcon({ chainId, size = 32, className = "", showRing = false }: ChainIconProps) {
  const [error, setError] = useState(false);

  const meta = CHAIN_LOGOS[chainId];
  const bg   = meta?.bg ?? "#1a2a4a";
  const name = meta?.name ?? chainId;

  const ringStyle: React.CSSProperties = showRing
    ? { boxShadow: `0 0 0 2px ${bg}50, 0 0 6px ${bg}30` }
    : {};

  const style: React.CSSProperties = {
    width: size, height: size,
    borderRadius: "50%",
    overflow: "hidden",
    flexShrink: 0,
    background: bg,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    ...ringStyle,
  };

  if (!meta || error) {
    return (
      <div style={style} className={className}>
        <span style={{ fontSize: size * 0.38, fontWeight: 700, color: "#fff", lineHeight: 1 }}>
          {name.slice(0, 2).toUpperCase()}
        </span>
      </div>
    );
  }

  return (
    <div style={style} className={className}>
      <Image
        src={meta.src}
        alt={name}
        width={size}
        height={size}
        style={{ objectFit: "cover", width: "100%", height: "100%" }}
        onError={() => setError(true)}
        unoptimized
      />
    </div>
  );
}
