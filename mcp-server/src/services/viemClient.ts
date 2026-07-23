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

  const urls =
    chainName === 'arcTestnet'
      ? [
          customRpc ?? 'https://rpc.testnet.arc.network',
          ...(process.env.RPC_ARC_FALLBACK_URLS ?? '')
            .split(',')
            .map((url) => url.trim())
            .filter(Boolean),
        ]
      : [customRpc].filter((url): url is string => Boolean(url));

  return createPublicClient({
    chain,
    transport:
      urls.length > 1
        ? fallback(urls.map((url) => http(url, { timeout: 10_000 })))
        : http(urls[0], { timeout: 10_000 }),
  });
};

export const getChainId = (chainName: SupportedChain) => chains[chainName].id;
