import React, { useState, useEffect, useRef } from 'react';
import { useSendTransaction, useWaitForTransactionReceipt, useAccount, useReadContract, useWriteContract, usePublicClient, useSwitchChain, useConfig } from 'wagmi';
import { waitForTransactionReceipt } from '@wagmi/core';
import { erc20Abi, maxUint256 } from 'viem';
import { Loader2, ArrowRight, ShieldCheck, CheckCircle, Unlock, Copy, ExternalLink, X } from 'lucide-react';

interface TransactionPreviewCardProps {
  toolName: string;
  args: Record<string, any>;
  unsignedTx: {
    to: string;
    data: string;
    value: string;
  };
  /** Starts the following strategy step only after this wallet transaction is mined. */
  onStrategyStepSuccess?: () => void;
}

import { ARC_TOKENS } from '@/lib/arcTokens';
import { sepolia, arbitrumSepolia, baseSepolia, polygonAmoy, avalancheFuji, optimismSepolia } from 'viem/chains';
import { arcTestnet } from '@/app/providers';

const getChainId = (chainName: string) => {
  if (!chainName) return arcTestnet.id;
  const name = chainName.toLowerCase();
  if (name.includes('sepolia') && !name.includes('arbitrum') && !name.includes('base') && !name.includes('optimism')) return sepolia.id;
  if (name.includes('arbitrumsepolia') || name === 'arbitrum_sepolia') return arbitrumSepolia.id;
  if (name.includes('basesepolia') || name === 'base_sepolia') return baseSepolia.id;
  if (name.includes('polygonamoy') || name === 'polygon_amoy') return polygonAmoy.id;
  if (name.includes('avalanchefuji') || name === 'avalanche_fuji') return avalancheFuji.id;
  if (name.includes('optimismsepolia') || name === 'optimism_sepolia') return optimismSepolia.id;
  return arcTestnet.id;
};

const getExplorerUrl = (chainName: string, hash: string) => {
  const chainId = getChainId(chainName);
  switch (chainId) {
    case sepolia.id: return `https://sepolia.etherscan.io/tx/${hash}`;
    case arbitrumSepolia.id: return `https://sepolia.arbiscan.io/tx/${hash}`;
    case baseSepolia.id: return `https://sepolia.basescan.org/tx/${hash}`;
    case polygonAmoy.id: return `https://amoy.polygonscan.com/tx/${hash}`;
    case avalancheFuji.id: return `https://testnet.snowtrace.io/tx/${hash}`;
    case optimismSepolia.id: return `https://sepolia-optimism.etherscan.io/tx/${hash}`;
    default: return `https://testnet.arcscan.app/tx/${hash}`;
  }
};

function resolveAddress(tokenOrAddress: string, chainName?: string): string {
  if (!tokenOrAddress) return tokenOrAddress;
  if (tokenOrAddress.startsWith('0x')) return tokenOrAddress;
  const upper = tokenOrAddress.toUpperCase();
  
  if (upper === 'USDC') {
    const name = (chainName || '').toLowerCase();
    if (name.includes('sepolia') && !name.includes('arbitrum') && !name.includes('base') && !name.includes('optimism')) {
      return '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'; // Sepolia USDC
    }
  }

  if (upper in ARC_TOKENS) {
    return ARC_TOKENS[upper as keyof typeof ARC_TOKENS].address;
  }
  return tokenOrAddress;
}

export function TransactionPreviewCard({ toolName, args, unsignedTx, onStrategyStepSuccess }: TransactionPreviewCardProps) {
  const { address: userAddress, chainId: currentChainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();

  // Extract needed approvals based on toolName
  const approvalsNeeded: Array<{ token: string, amount: bigint, spender: string }> = [];

  if (toolName === 'deposit' || toolName === 'repay') {
    const tokenAddr = resolveAddress(args.asset, args.chain);
    if (tokenAddr && args.amount && tokenAddr !== '0x0000000000000000000000000000000000000000') {
      approvalsNeeded.push({ token: tokenAddr, amount: BigInt(args.amount), spender: unsignedTx.to });
    }
  } else if (toolName === 'swap') {
    if (args.path && args.path.length > 0 && args.amountIn) {
      const tokenAddr = resolveAddress(args.path[0], args.chain);
      if (tokenAddr !== '0x0000000000000000000000000000000000000000') {
        approvalsNeeded.push({ token: tokenAddr, amount: BigInt(args.amountIn), spender: unsignedTx.to });
      }
    }
  } else if (toolName === 'bridge') {
    const tokenAddr = resolveAddress(args.burnToken, args.chain);
    if (tokenAddr && args.amount && tokenAddr !== '0x0000000000000000000000000000000000000000') {
      approvalsNeeded.push({ token: tokenAddr, amount: BigInt(args.amount), spender: unsignedTx.to });
    }
  } else if (toolName === 'addLiquidity') {
    if (args.tokenA && args.amountA) {
      const tokenAAddr = resolveAddress(args.tokenA, args.chain);
      if (tokenAAddr !== '0x0000000000000000000000000000000000000000') {
        approvalsNeeded.push({ token: tokenAAddr, amount: BigInt(args.amountA), spender: unsignedTx.to });
      }
    }
    if (args.tokenB && args.amountB) {
      const tokenBAddr = resolveAddress(args.tokenB, args.chain);
      if (tokenBAddr !== '0x0000000000000000000000000000000000000000') {
        approvalsNeeded.push({ token: tokenBAddr, amount: BigInt(args.amountB), spender: unsignedTx.to });
      }
    }
  }

  const [approvalIndex, setApprovalIndex] = useState(0);
  const currentApproval = approvalsNeeded[approvalIndex];

  // 1. Read Allowance
  const { data: currentAllowance, refetch: refetchAllowance, isLoading: isCheckingAllowance, isError: isAllowanceError } = useReadContract({
    chainId: getChainId(args.chain),
    address: currentApproval?.token as `0x${string}`,
    abi: erc20Abi,
    functionName: 'allowance',
    args: userAddress && currentApproval ? [userAddress, currentApproval.spender as `0x${string}`] : undefined,
    query: {
      enabled: !!userAddress && !!currentApproval,
    }
  });

  // If there's an error fetching allowance, or if it's undefined, we default to needing approval to be safe.
  const needsApproval = currentApproval && (currentAllowance === undefined || currentAllowance < currentApproval.amount);

  // 2. Write Approve
  const { writeContractAsync: approve, error: approveError } = useWriteContract();
  const [isApproving, setIsApproving] = useState(false);
  const [isApproveMining, setIsApproveMining] = useState(false);
  
  const config = useConfig();

  const handleApprove = async () => {
    if (!currentApproval) return;
    setIsApproving(true);
    try {
      const targetChainId = getChainId(args.chain);
      if (currentChainId !== targetChainId) {
        await switchChainAsync({ chainId: targetChainId });
      }
      const hash = await approve({
        address: currentApproval.token as `0x${string}`,
        abi: erc20Abi,
        functionName: 'approve',
        args: [currentApproval.spender as `0x${string}`, currentApproval.amount], // or maxUint256
      });
      
      setIsApproving(false);
      setIsApproveMining(true);
      
      await waitForTransactionReceipt(config, { 
        hash,
        chainId: targetChainId
      });
      
      await refetchAllowance();
      if (approvalIndex < approvalsNeeded.length - 1) {
        setApprovalIndex(approvalIndex + 1);
      }
    } catch (e) {
      console.error("Approve failed:", e);
    } finally {
      setIsApproving(false);
      setIsApproveMining(false);
    }
  };

  const { sendTransaction, data: hash, isPending: isConfirming, error: sendError } = useSendTransaction();
  
  const { isLoading: isMining, isSuccess, data: receipt } = useWaitForTransactionReceipt({ 
    chainId: getChainId(args.chain),
    hash 
  });

  const [isToastClosed, setIsToastClosed] = useState(false);
  const reportedStrategySuccess = useRef(false);

  // Reset toast if a new transaction starts
  useEffect(() => {
    if (isConfirming) setIsToastClosed(false);
  }, [isConfirming]);

  useEffect(() => {
    if (!isSuccess || !onStrategyStepSuccess || reportedStrategySuccess.current) return;
    reportedStrategySuccess.current = true;
    onStrategyStepSuccess();
  }, [isSuccess, onStrategyStepSuccess]);



  const handleConfirm = async () => {
    if (!unsignedTx) return;
    
    try {
      const targetChainId = getChainId(args.chain);
      if (currentChainId !== targetChainId) {
        await switchChainAsync({ chainId: targetChainId });
      }
    } catch (e) {
      console.warn("Failed to switch chain", e);
      return; // Stop if user rejects switch
    }



    sendTransaction({
      to: unsignedTx.to as `0x${string}`,
      data: unsignedTx.data as `0x${string}`,
      value: BigInt(unsignedTx.value || "0"),
      gas: 500000n, // Hardcode gas limit
      maxFeePerGas: 25000000000n, // 25 gwei
      maxPriorityFeePerGas: 25000000000n, // 25 gwei
    });
  };

  // Human readable title based on tool
  const title = toolName.charAt(0).toUpperCase() + toolName.slice(1);

  // Determine Toast Status
  let toastStatus: 'signing' | 'confirming' | 'success' | null = null;
  if (!isToastClosed) {
    if (isSuccess) toastStatus = 'success';
    else if (isMining) toastStatus = 'confirming';
    else if (isConfirming) toastStatus = 'signing';
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const renderToast = () => {
    if (!toastStatus) return null;

    return (
      <div className="fixed top-6 right-6 z-[100] min-w-[340px] max-w-[400px] bg-[#0D0E1E] border border-white/10 rounded-2xl p-5 shadow-2xl animate-in slide-in-from-right fade-in duration-300">
        <button onClick={() => setIsToastClosed(true)} className="absolute top-4 right-4 text-white/50 hover:text-white">
          <X className="w-4 h-4" />
        </button>

        {toastStatus === 'signing' && (
          <div className="flex items-start gap-3">
            <Loader2 className="w-5 h-5 text-[#A998FF] animate-spin mt-0.5" />
            <div>
              <h4 className="font-bold text-white mb-1">Signing Transaction</h4>
              <p className="text-sm text-white/60">Requesting wallet signature...</p>
            </div>
          </div>
        )}

        {toastStatus === 'confirming' && (
          <div className="flex items-start gap-3">
            <Loader2 className="w-5 h-5 text-[#A998FF] animate-spin mt-0.5" />
            <div className="w-full pr-4">
              <h4 className="font-bold text-white mb-1">Confirming on Blockchain</h4>
              <p className="text-sm text-white/60 mb-3">Waiting for blockchain confirmation...</p>
              {hash && (
                <div className="flex items-center justify-between bg-black/30 rounded-lg p-2 text-xs text-white/70">
                  <span className="text-white/50">TX Hash:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono">{hash.slice(0, 10)}...{hash.slice(-8)}</span>
                    <button onClick={() => copyToClipboard(hash)} className="hover:text-white"><Copy className="w-3 h-3" /></button>
                    <a href={getExplorerUrl(args.chain, hash)} target="_blank" rel="noreferrer" className="hover:text-white"><ExternalLink className="w-3 h-3" /></a>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (isSuccess) {
    return (
      <div className="flex w-full justify-start mt-2 mb-4">
        <div className="bg-[#0D0E1E] border border-white/10 rounded-2xl p-5 shadow-xl w-full max-w-md">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
              <CheckCircle className="w-4 h-4 text-green-500" />
            </div>
            <div className="w-full">
              <h4 className="font-bold text-white mb-1">{title} Confirmed</h4>
              <p className="text-sm text-white/60 mb-3">{title} completed successfully!</p>
              
              {hash && (
                <div className="flex items-center justify-between bg-black/30 rounded-lg p-2 text-xs text-white/70 mb-2">
                  <span className="text-white/50">TX Hash:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono">{hash.slice(0, 10)}...{hash.slice(-8)}</span>
                    <button onClick={() => copyToClipboard(hash)} className="hover:text-white"><Copy className="w-3 h-3" /></button>
                    <a href={getExplorerUrl(args.chain, hash)} target="_blank" rel="noreferrer" className="hover:text-white"><ExternalLink className="w-3 h-3" /></a>
                  </div>
                </div>
              )}
              
              {receipt?.blockNumber && (
                <div className="text-xs text-white/50">
                  Block: {receipt.blockNumber.toString()}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full justify-start mb-4 relative">
      {renderToast()}
      <div className="w-full max-w-sm bg-zinc-900 border border-zinc-700/60 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-100 flex items-center">
            <ShieldCheck className="w-4 h-4 text-blue-500 mr-2" />
            Sign {title}
          </h3>
          <span className="text-xs font-mono bg-zinc-800 text-zinc-400 px-2 py-1 rounded">
            {args.chain || 'Unknown Network'}
          </span>
        </div>

        <div className="space-y-3 mb-5">
          {Object.entries(args).map(([key, value]) => {
            if (key === 'chain' || key === 'path') return null; // hide path array for simplicity
            return (
              <div key={key} className="flex justify-between items-center text-sm">
                <span className="text-zinc-500 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                <span className="text-zinc-200 font-medium truncate max-w-[150px]" title={String(value)}>
                  {String(value)}
                </span>
              </div>
            );
          })}
        </div>

        {(sendError || approveError) && (
          <div className="mb-4 p-2 bg-red-900/20 border border-red-500/30 rounded text-xs text-red-400 break-words">
            {sendError?.message.split('\n')[0] || approveError?.message.split('\n')[0]}
          </div>
        )}

        {needsApproval ? (
          <button
            onClick={handleApprove}
            disabled={isApproving || isApproveMining}
            className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-xl transition-colors flex items-center justify-center"
          >
            {isApproving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Check Wallet...
              </>
            ) : isApproveMining ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Approving...
              </>
            ) : (
              <>
                Approve Token {approvalsNeeded.length > 1 ? `(${approvalIndex + 1}/${approvalsNeeded.length})` : ''} <Unlock className="w-4 h-4 ml-2" />
              </>
            )}
          </button>
        ) : (
          <button
            onClick={handleConfirm}
            disabled={isConfirming || isMining}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-xl transition-colors flex items-center justify-center"
          >
            {isConfirming ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Check Wallet...
              </>
            ) : isMining ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Mining...
              </>
            ) : (
              <>
                Confirm {title} <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
