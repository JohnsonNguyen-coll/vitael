import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSendTransaction, useAccount, useReadContract, useWriteContract, useSwitchChain, useConfig } from 'wagmi';
import { waitForTransactionReceipt } from '@wagmi/core';
import { erc20Abi } from 'viem';
import { Loader2, Copy, ExternalLink, X } from 'lucide-react';

interface UnsignedTransactionStep {
  to: string;
  data: string;
  value: string;
  label?: string;
}

interface RequiredApproval {
  token: string;
  amount: string;
  spender: string;
}

interface TransactionPreviewCardProps {
  toolName: string;
  args: Record<string, unknown> & {
    chain?: string;
    asset?: string;
    amount?: string;
    amountIn?: string;
    path?: string[];
    burnToken?: string;
    tokenA?: string;
    amountA?: string;
    tokenB?: string;
    amountB?: string;
  };
  unsignedTx: {
    to: string;
    data: string;
    value: string;
    transactions?: UnsignedTransactionStep[];
    approvals?: RequiredApproval[];
  };
  /** Starts the following strategy step only after this wallet transaction is mined. */
  onStrategyStepSuccess?: () => void;
}

import { ARC_TOKENS } from '@/lib/arcTokens';
import { confirmBridgeMint } from '@/hooks/useCCTPBridge';
import { CCTP_CHAINS, arcMainnet } from '@/lib/cctpMainnet';
const getChainId = (chainName?: string) => {
  if (!chainName) return arcMainnet.id;
  const chain = Object.values(CCTP_CHAINS).find(c => c.name.toLowerCase() === chainName.toLowerCase());
  if (!chain) throw new Error(`Unsupported mainnet chain: ${chainName}`);
  return chain.chainId;
};
const getExplorerUrl = (chainName: string | undefined, hash: string) => {
  const chain = Object.values(CCTP_CHAINS).find(c => c.chainId === getChainId(chainName));
  return `${chain!.explorer}${hash}`;
};

function resolveAddress(tokenOrAddress?: string, chainName?: string): string {
  if (!tokenOrAddress) return '';
  if (tokenOrAddress.startsWith('0x')) return tokenOrAddress;
  const upper = tokenOrAddress.toUpperCase();
  const mainnet = Object.values(CCTP_CHAINS).find(c => c.name.toLowerCase() === chainName?.toLowerCase());
  if (mainnet && upper === 'USDC') return mainnet.usdc;
  
  if (upper in ARC_TOKENS) {
    return ARC_TOKENS[upper as keyof typeof ARC_TOKENS].address;
  }
  return tokenOrAddress;
}

export function TransactionPreviewCard({ toolName, args, unsignedTx, onStrategyStepSuccess }: TransactionPreviewCardProps) {
  const { address: userAddress, chainId: currentChainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();

  // Extract needed approvals based on toolName
  const approvalsNeeded: Array<{ token: string, amount: bigint, spender: string }> =
    (unsignedTx.approvals ?? []).map(approval => ({
      token: approval.token,
      amount: BigInt(approval.amount),
      spender: approval.spender,
    }));

  if (approvalsNeeded.length === 0 && (toolName === 'deposit' || toolName === 'repay')) {
    const tokenAddr = resolveAddress(args.asset, args.chain);
    if (tokenAddr && args.amount && tokenAddr !== '0x0000000000000000000000000000000000000000') {
      approvalsNeeded.push({ token: tokenAddr, amount: BigInt(args.amount), spender: unsignedTx.to });
    }
  } else if (approvalsNeeded.length === 0 && toolName === 'swap') {
    if (args.path && args.path.length > 0 && args.amountIn) {
      const tokenAddr = resolveAddress(args.path[0], args.chain);
      if (tokenAddr !== '0x0000000000000000000000000000000000000000') {
        approvalsNeeded.push({ token: tokenAddr, amount: BigInt(args.amountIn), spender: unsignedTx.to });
      }
    }
  } else if (approvalsNeeded.length === 0 && toolName === 'bridge') {
    const tokenAddr = resolveAddress(args.burnToken, args.chain);
    if (tokenAddr && args.amount && tokenAddr !== '0x0000000000000000000000000000000000000000') {
      approvalsNeeded.push({ token: tokenAddr, amount: BigInt(args.amount), spender: unsignedTx.to });
    }
  } else if (approvalsNeeded.length === 0 && toolName === 'addLiquidity' && !unsignedTx.transactions?.length) {
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
  const [localError, setLocalError] = useState<string | null>(null);
  const currentApproval = approvalsNeeded[approvalIndex];

  // 1. Read Allowance
  const { data: currentAllowance, refetch: refetchAllowance } = useReadContract({
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
    setLocalError(null);
    setIsToastClosed(false);
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
      
      const receipt = await waitForTransactionReceipt(config, {
        hash,
        chainId: targetChainId
      });
      if (receipt.status === 'reverted') {
        throw new Error('Approval reverted on-chain');
      }
      
      await refetchAllowance();
      if (approvalIndex < approvalsNeeded.length - 1) {
        setApprovalIndex(approvalIndex + 1);
      }
    } catch (e) {
      console.error("Approve failed:", e);
      setLocalError(e instanceof Error ? e.message.split('\n')[0] : 'Approval failed');
    } finally {
      setIsApproving(false);
      setIsApproveMining(false);
    }
  };

  const { sendTransactionAsync, error: sendError } = useSendTransaction();
  const [transactionStatus, setTransactionStatus] =
    useState<'idle' | 'signing' | 'confirming' | 'success'>('idle');
  const [hash, setHash] = useState<`0x${string}` | undefined>();
  const [confirmedBlock, setConfirmedBlock] = useState<bigint | undefined>();
  const [activeStep, setActiveStep] = useState(0);
  const transactions =
    unsignedTx.transactions && unsignedTx.transactions.length > 0
      ? unsignedTx.transactions
      : [{ to: unsignedTx.to, data: unsignedTx.data, value: unsignedTx.value }];
  const isConfirming = transactionStatus === 'signing';
  const isMining = transactionStatus === 'confirming';
  const isSuccess = transactionStatus === 'success';

  const [isToastClosed, setIsToastClosed] = useState(false);
  const reportedStrategySuccess = useRef(false);

  // Reset toast if a new transaction starts
  useEffect(() => {
    if (!isSuccess || !onStrategyStepSuccess || reportedStrategySuccess.current) return;
    reportedStrategySuccess.current = true;
    onStrategyStepSuccess();
  }, [isSuccess, onStrategyStepSuccess]);



  const handleConfirm = async () => {
    if (!unsignedTx) return;
    setLocalError(null);
    setIsToastClosed(false);

    try {
      const targetChainId = getChainId(args.chain);
      if (currentChainId !== targetChainId) {
        await switchChainAsync({ chainId: targetChainId });
      }
      for (let index = 0; index < transactions.length; index += 1) {
        const transaction = transactions[index];
        setActiveStep(index);
        setTransactionStatus('signing');
        const nextHash = await sendTransactionAsync({
          to: transaction.to as `0x${string}`,
          data: transaction.data as `0x${string}`,
          value: BigInt(transaction.value || '0'),
          chainId: targetChainId,
        });
        setHash(nextHash);
        setTransactionStatus('confirming');
        const receipt = await waitForTransactionReceipt(config, {
          hash: nextHash,
          chainId: targetChainId,
        });
        if (receipt.status === 'reverted') {
          throw new Error(`${transaction.label ?? 'Transaction'} reverted on-chain`);
        }
        if (toolName === 'bridge') {
          const source = Object.values(CCTP_CHAINS).find(c => c.chainId === targetChainId);
          if (!source) throw new Error('Unsupported mainnet bridge source');
          await confirmBridgeMint(source.domain, Number(args.destinationDomain), nextHash);
        }
        setConfirmedBlock(receipt.blockNumber);
      }
      setTransactionStatus('success');
    } catch (e) {
      console.warn('Transaction failed', e);
      setTransactionStatus('idle');
      setLocalError(e instanceof Error ? e.message.split('\n')[0] : 'Transaction failed');
    }
  };

  // Human readable title based on tool
  const title = toolName.charAt(0).toUpperCase() + toolName.slice(1);

  // Determine Toast Status
  let toastStatus: 'signing' | 'confirming' | 'success' | null = null;
  if (!isToastClosed) {
    if (isSuccess) toastStatus = 'success';
    else if (isMining) toastStatus = 'confirming';
    else if (isConfirming || isApproving) toastStatus = 'signing';
    else if (isApproveMining) toastStatus = 'confirming';
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const renderToast = () => {
    if (!toastStatus || typeof document === 'undefined') return null;
    const stepLabel = transactions[activeStep]?.label;
    const stepProgress = transactions.length > 1
      ? `Step ${activeStep + 1} of ${transactions.length}`
      : null;

    return createPortal(
      <div className="fixed top-[88px] right-4 sm:right-6 z-[1000] min-w-[300px] max-w-[calc(100vw-2rem)] sm:min-w-[340px] sm:max-w-[400px] bg-[#0D0E1E] border border-white/10 rounded-2xl p-5 shadow-2xl animate-in slide-in-from-right fade-in duration-300">
        <button onClick={() => setIsToastClosed(true)} className="absolute top-4 right-4 text-white/50 hover:text-white">
          <X className="w-4 h-4" />
        </button>

        {toastStatus === 'signing' && (
          <div className="flex items-start gap-3">
             <Loader2 className="w-5 h-5 text-[#9da3b4] animate-spin mt-0.5" />
            <div>
              <h4 className="font-bold text-white mb-1">Signing Transaction</h4>
              <p className="text-sm text-white/60">{stepLabel ?? 'Requesting wallet signature...'}</p>
              {stepProgress && <p className="mt-1 text-xs text-white/40">{stepProgress}</p>}
            </div>
          </div>
        )}

        {toastStatus === 'confirming' && (
          <div className="flex items-start gap-3">
             <Loader2 className="w-5 h-5 text-[#9da3b4] animate-spin mt-0.5" />
            <div className="w-full pr-4">
              <h4 className="font-bold text-white mb-1">Confirming on Blockchain</h4>
              <p className="text-sm text-white/60 mb-1">{stepLabel ?? 'Waiting for blockchain confirmation...'}</p>
              {stepProgress && <p className="mb-3 text-xs text-white/40">{stepProgress}</p>}
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
        {toastStatus === 'success' && (
          <div className="pr-6">
            <h4 className="font-bold text-white mb-1">{title} Confirmed</h4>
            <p className="text-sm text-white/60">All transaction steps completed successfully.</p>
          </div>
        )}
      </div>
      ,
      document.body,
    );
  };

  if (isSuccess) {
    return (
      <div className="flex w-full justify-start mb-3">
        {renderToast()}
        <div className="w-full max-w-md rounded-xl border border-white/[0.09] bg-[#111219] p-4 shadow-lg">
           <div className="flex items-start gap-3">
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
              
              {confirmedBlock && (
                <div className="text-xs text-white/50">
                  Block: {confirmedBlock.toString()}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex w-full justify-start mb-3">
      {renderToast()}
       <div className="w-full max-w-md rounded-xl border border-white/[0.09] bg-[#111219] p-4">
        <div className="flex items-center justify-between mb-4">
           <h3 className="font-semibold text-gray-100">Review {title}</h3>
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

        {(localError || sendError || approveError) && (
          <div className="mb-4 p-2 bg-red-900/20 border border-red-500/30 rounded text-xs text-red-400 break-words">
            {localError || sendError?.message.split('\n')[0] || approveError?.message.split('\n')[0]}
          </div>
        )}

        {needsApproval ? (
          <button
            onClick={handleApprove}
            disabled={isApproving || isApproveMining}
             className="flex w-full items-center justify-center rounded-lg bg-[#d8d2ff] py-2.5 font-medium text-[#111219] transition-colors hover:bg-white disabled:bg-zinc-700 disabled:text-zinc-500"
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
               <>Approve token {approvalsNeeded.length > 1 ? `(${approvalIndex + 1}/${approvalsNeeded.length})` : ''}</>
            )}
          </button>
        ) : (
          <button
            onClick={handleConfirm}
            disabled={isConfirming || isMining}
             className="flex w-full items-center justify-center rounded-lg bg-[#d8d2ff] py-2.5 font-medium text-[#111219] transition-colors hover:bg-white disabled:bg-zinc-700 disabled:text-zinc-500"
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
               <>Confirm {title}{transactions.length > 1 ? ` (${transactions.length} steps)` : ''}</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
