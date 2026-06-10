import { createPublicClient, http, defineChain } from 'viem';
import { sepolia, arbitrumSepolia, baseSepolia, polygonAmoy, avalancheFuji, optimismSepolia } from 'viem/chains';

// Define Arc Testnet as it might not be in viem/chains natively
export const arcTestnet = defineChain({
  id: 4242, // Dummy ID for Arc testnet, update if specific ID exists
  name: 'Arc Testnet',
  network: 'arc-testnet',
  nativeCurrency: { name: 'Arc', symbol: 'ARC', decimals: 18 },
  rpcUrls: {
    default: {
      http: [process.env.RPC_ARC_TESTNET || 'https://rpc.testnet.arc.network'],
    },
    public: {
      http: [process.env.RPC_ARC_TESTNET || 'https://rpc.testnet.arc.network'],
    },
  },
});

const chains = {
  sepolia,
  arbitrumSepolia,
  baseSepolia,
  polygonAmoy,
  avalancheFuji,
  optimismSepolia,
  arcTestnet,
};

export type SupportedChain = keyof typeof chains;

// Map chain names to their alchemy network names
const alchemyNetworkNames: Partial<Record<SupportedChain, string>> = {
  sepolia: 'eth-sepolia',
  arbitrumSepolia: 'arb-sepolia',
  baseSepolia: 'base-sepolia',
  polygonAmoy: 'polygon-amoy',
  optimismSepolia: 'opt-sepolia',
};

export const getClient = (chainName: SupportedChain) => {
  const chain = chains[chainName];
  if (!chain) {
    throw new Error(`Unsupported chain: ${chainName}`);
  }

  // Allow custom RPCs via env variables
  const envKey = `RPC_${chainName.toUpperCase().replace(/([A-Z])/g, '_$1')}`;
  let customRpc = process.env[envKey];

  // Fallback to Alchemy if available for standard networks
  if (!customRpc && process.env.NEXT_PUBLIC_ALCHEMY_API_KEY && alchemyNetworkNames[chainName]) {
    customRpc = `https://${alchemyNetworkNames[chainName]}.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`;
  }

  return createPublicClient({
    chain,
    transport: http(customRpc || undefined),
  });
};

export const getChainId = (chainName: SupportedChain) => chains[chainName].id;
