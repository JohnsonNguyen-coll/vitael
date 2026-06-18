import React, { useState, useEffect } from 'react';
import { useSendTransaction, useWaitForTransactionReceipt, useAccount, useReadContract, useWriteContract } from 'wagmi';
import { erc20Abi, maxUint256 } from 'viem';
import { Loader2, ArrowRight, ShieldCheck, CheckCircle, Unlock } from 'lucide-react';

interface TransactionPreviewCardProps {
  toolName: string;
  args: Record<string, any>;
  unsignedTx: {
    to: string;
    data: string;
    value: string;
  };
}

export function TransactionPreviewCard({ toolName, args, unsignedTx }: TransactionPreviewCardProps) {
  const { address: userAddress } = useAccount();

  // Extract needed approvals based on toolName
  const approvalsNeeded: Array<{ token: string, amount: bigint, spender: string }> = [];

  if (toolName === 'deposit' || toolName === 'repay') {
    if (args.asset && args.amount && args.asset !== '0x0000000000000000000000000000000000000000') {
      approvalsNeeded.push({ token: args.asset, amount: BigInt(args.amount), spender: unsignedTx.to });
    }
  } else if (toolName === 'swap') {
    if (args.path && args.path.length > 0 && args.amountIn && args.path[0] !== '0x0000000000000000000000000000000000000000') {
      approvalsNeeded.push({ token: args.path[0], amount: BigInt(args.amountIn), spender: unsignedTx.to });
    }
  } else if (toolName === 'bridge') {
    if (args.burnToken && args.amount && args.burnToken !== '0x0000000000000000000000000000000000000000') {
      approvalsNeeded.push({ token: args.burnToken, amount: BigInt(args.amount), spender: unsignedTx.to });
    }
  } else if (toolName === 'addLiquidity') {
    if (args.tokenA && args.amountA && args.tokenA !== '0x0000000000000000000000000000000000000000') {
      approvalsNeeded.push({ token: args.tokenA, amount: BigInt(args.amountA), spender: unsignedTx.to });
    }
    if (args.tokenB && args.amountB && args.tokenB !== '0x0000000000000000000000000000000000000000') {
      approvalsNeeded.push({ token: args.tokenB, amount: BigInt(args.amountB), spender: unsignedTx.to });
    }
  }

  const [approvalIndex, setApprovalIndex] = useState(0);
  const currentApproval = approvalsNeeded[approvalIndex];

  // 1. Read Allowance
  const { data: currentAllowance, refetch: refetchAllowance, isLoading: isCheckingAllowance } = useReadContract({
    address: currentApproval?.token as `0x${string}`,
    abi: erc20Abi,
    functionName: 'allowance',
    args: userAddress && currentApproval ? [userAddress, currentApproval.spender as `0x${string}`] : undefined,
    query: {
      enabled: !!userAddress && !!currentApproval,
    }
  });

  const needsApproval = currentApproval && currentAllowance !== undefined && currentAllowance < currentApproval.amount;

  // 2. Write Approve
  const { writeContractAsync: approve, isPending: isApproving, error: approveError } = useWriteContract();
  
  // 3. Wait for Approve receipt
  const [approveHash, setApproveHash] = useState<`0x${string}` | undefined>(undefined);
  const { isLoading: isApproveMining, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({
    hash: approveHash,
  });

  useEffect(() => {
    if (isApproveSuccess) {
      refetchAllowance().then(() => {
        if (approvalIndex < approvalsNeeded.length - 1) {
          setApprovalIndex(approvalIndex + 1);
          setApproveHash(undefined);
        }
      });
    }
  }, [isApproveSuccess, approvalIndex, approvalsNeeded.length, refetchAllowance]);

  const handleApprove = async () => {
    if (!currentApproval) return;
    try {
      const hash = await approve({
        address: currentApproval.token as `0x${string}`,
        abi: erc20Abi,
        functionName: 'approve',
        args: [currentApproval.spender as `0x${string}`, currentApproval.amount], // or maxUint256
      });
      setApproveHash(hash);
    } catch (e) {
      console.error(e);
    }
  };

  const { sendTransaction, data: hash, isPending: isConfirming, error: sendError } = useSendTransaction();
  
  const { isLoading: isMining, isSuccess } = useWaitForTransactionReceipt({ 
    hash 
  });

  const handleConfirm = () => {
    if (!unsignedTx) return;
    
    sendTransaction({
      to: unsignedTx.to as `0x${string}`,
      data: unsignedTx.data as `0x${string}`,
      value: BigInt(unsignedTx.value || "0"),
    });
  };

  // Human readable title based on tool
  const title = toolName.charAt(0).toUpperCase() + toolName.slice(1);

  if (isSuccess) {
    return (
      <div className="flex w-full justify-start mb-4">
        <div className="w-full max-w-sm bg-emerald-900/20 border border-emerald-500/30 rounded-2xl p-5">
          <div className="flex items-center space-x-3 mb-2 text-emerald-400">
            <CheckCircle className="w-6 h-6" />
            <h3 className="font-semibold text-lg">Transaction Successful</h3>
          </div>
          <p className="text-emerald-200/70 text-sm break-all">Hash: {hash}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full justify-start mb-4">
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

        {isCheckingAllowance ? (
          <button disabled className="w-full py-2.5 bg-zinc-800 text-zinc-500 font-medium rounded-xl flex items-center justify-center">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Checking Allowance...
          </button>
        ) : needsApproval ? (
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
