import { createPublicClient, fallback, http, defineChain } from 'viem';
import { sepolia, arbitrumSepolia, baseSepolia, polygonAmoy, avalancheFuji, optimismSepolia } from 'viem/chains';

// Define Arc Testnet as it might not be in viem/chains natively
export const arcTestnet = defineChain({
  id: 5042002, // Arc Testnet chain ID
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

const rpcEnvKeys: Record<SupportedChain, string> = {
  sepolia: 'RPC_SEPOLIA',
  arbitrumSepolia: 'RPC_ARBITRUM_SEPOLIA',
  baseSepolia: 'RPC_BASE_SEPOLIA',
  polygonAmoy: 'RPC_POLYGON_AMOY',
  avalancheFuji: 'RPC_AVALANCHE_FUJI',
  optimismSepolia: 'RPC_OPTIMISM_SEPOLIA',
  arcTestnet: 'RPC_ARC_TESTNET',
};

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

  let customRpc = process.env[rpcEnvKeys[chainName]];

  if (!customRpc && process.env.ALCHEMY_API_KEY && alchemyNetworkNames[chainName]) {
    customRpc = `https://${alchemyNetworkNames[chainName]}.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
  }

  const publicFallbacks: Record<SupportedChain, string[]> = {
    sepolia: [
      'https://ethereum-sepolia-rpc.publicnode.com',
      'https://rpc.sepolia.org',
      'https://sepolia.drpc.org',
    ],
    arbitrumSepolia: [
      'https://sepolia-rollup.arbitrum.io/rpc',
      'https://arbitrum-sepolia-rpc.publicnode.com',
    ],
    baseSepolia: [
      'https://sepolia.base.org',
      'https://base-sepolia-rpc.publicnode.com',
    ],
    polygonAmoy: [
      'https://rpc-amoy.polygon.technology',
      'https://polygon-amoy-bor-rpc.publicnode.com',
    ],
    avalancheFuji: [
      'https://api.avax-test.network/ext/bc/C/rpc',
      'https://avalanche-fuji-c-chain-rpc.publicnode.com',
    ],
    optimismSepolia: [
      'https://sepolia.optimism.io',
      'https://optimism-sepolia-rpc.publicnode.com',
    ],
    arcTestnet: [
      'https://rpc.testnet.arc.network',
      'https://rpc.blockdaemon.testnet.arc.network',
      'https://rpc.drpc.testnet.arc.network',
      'https://rpc.quicknode.testnet.arc.network',
    ],
  };

  const configuredFallbacks =
    chainName === 'arcTestnet'
      ? (process.env.RPC_ARC_FALLBACK_URLS ?? '').split(',')
      : [];
  const urls = [
    customRpc,
    ...configuredFallbacks,
    ...publicFallbacks[chainName],
  ]
    .map((url) => url?.trim())
    .filter((url): url is string => Boolean(url))
    .filter((url, index, all) => all.indexOf(url) === index);

  return createPublicClient({
    chain,
    transport: fallback(
      urls.map((url) => http(url, { timeout: 12_000, retryCount: 1 })),
    ),
  });
};

export const getChainId = (chainName: SupportedChain) => chains[chainName].id;
