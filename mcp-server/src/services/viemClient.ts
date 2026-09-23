import { createPublicClient, http } from 'viem';
import { CCTP_CHAINS, type CctpChain } from './cctpMainnet.js';
export type SupportedChain = CctpChain;
export const getClient = (name: SupportedChain) => {
  const config = CCTP_CHAINS[name];
  if (!config) throw new Error(`Unsupported mainnet chain: ${name}`);
  return createPublicClient({ chain: config.chain, transport: http(config.rpc, { timeout: 12000, retryCount: 1 }) });
};
export const getChainId = (name: SupportedChain) => CCTP_CHAINS[name].chainId;
