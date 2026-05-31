import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // CoinGecko CDN — token & chain logos
      {
        protocol: "https",
        hostname: "assets.coingecko.com",
        pathname: "/**",
      },
      // Trust Wallet assets on GitHub
      {
        protocol: "https",
        hostname: "raw.githubusercontent.com",
        pathname: "/trustwallet/assets/**",
      },
      // Circle brand assets
      {
        protocol: "https",
        hostname: "www.circle.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
