import React from 'react';
import { Loader2 } from 'lucide-react';

interface ToolCallCardProps {
  toolName: string;
  state: 'call' | 'result';
}

export function ToolCallCard({ toolName, state }: ToolCallCardProps) {
  // Map internal MCP tool names to user-friendly text
  const getActionText = (name: string) => {
    switch (name) {
      case 'getMarkets': return 'Fetching active markets...';
      case 'getPools': return 'Analyzing liquidity pools...';
      case 'getAPR': return 'Calculating latest yields...';
      case 'getPosition': return 'Checking your portfolio...';
      case 'getHealthFactor': return 'Evaluating health factor...';
      case 'quoteSwap': return 'Simulating swap routes...';
      case 'quoteBridge': return 'Estimating bridge fees...';
      case 'quoteAddLiquidity': return 'Calculating required liquidity...';
      case 'deposit': return 'Preparing deposit transaction...';
      case 'withdraw': return 'Preparing withdraw transaction...';
      case 'borrow': return 'Preparing borrow transaction...';
      case 'repay': return 'Preparing repay transaction...';
      case 'swap': return 'Preparing swap transaction...';
      case 'bridge': return 'Preparing bridge transaction...';
      case 'addLiquidity': return 'Preparing liquidity transaction...';
      case 'removeLiquidity': return 'Preparing liquidity removal...';
      default: return `Executing ${name}...`;
    }
  };

  return (
    <div className="flex w-full justify-start mb-4">
      <div className="flex items-center space-x-3 border-l border-white/15 px-3 py-1.5 text-xs text-[#7f8699]">
        {state === 'call' && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#9da3b4]" />}
        <span>{getActionText(toolName)}</span>
      </div>
    </div>
  );
}
