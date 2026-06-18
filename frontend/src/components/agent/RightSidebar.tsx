'use client';
import React from 'react';
import { Bot, Settings2, Wallet, Zap, Shield, LineChart, Activity } from 'lucide-react';
import { useAccount } from 'wagmi';

export function RightSidebar() {
  const { isConnected, address } = useAccount();

  const tools = [
    { name: 'Market Research', icon: <LineChart className="w-4 h-4 text-blue-400" /> },
    { name: 'Yield Scanner', icon: <Activity className="w-4 h-4 text-emerald-400" /> },
    { name: 'Risk Assessment', icon: <Shield className="w-4 h-4 text-red-400" /> },
  ];

  return (
    <div className="w-72 h-full border-l border-zinc-800/50 bg-zinc-900/30 overflow-y-auto shrink-0 hidden xl:block p-5">
      
      {/* Agent Info */}
      <div className="mb-8">
        <h3 className="text-xs uppercase tracking-widest text-zinc-500 font-semibold mb-4">Agent Profile</h3>
        <div className="bg-zinc-800/40 border border-zinc-800 rounded-xl p-4 flex items-center space-x-4">
          <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center border border-blue-500/30">
            <Bot className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h4 className="font-semibold text-white text-sm">Claude 3.5</h4>
            <div className="flex items-center text-xs text-emerald-400 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
              Operational
            </div>
          </div>
        </div>
      </div>

      {/* Wallet Status */}
      <div className="mb-8">
        <h3 className="text-xs uppercase tracking-widest text-zinc-500 font-semibold mb-4">Connection</h3>
        <div className="bg-zinc-800/40 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center space-x-3 mb-3">
            <div className={`p-2 rounded-lg ${isConnected ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">{isConnected ? 'Wallet Connected' : 'No Wallet'}</p>
              <p className="text-xs text-zinc-400">
                {isConnected && address 
                  ? `${address.slice(0, 6)}...${address.slice(-4)}` 
                  : 'Connect to execute'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="text-xs uppercase tracking-widest text-zinc-500 font-semibold mb-4">Quick Actions</h3>
        <div className="space-y-2">
          {tools.map((tool, idx) => (
            <button key={idx} className="w-full flex items-center justify-between bg-zinc-800/40 hover:bg-zinc-800 border border-zinc-800 rounded-xl p-3 transition-colors group">
              <div className="flex items-center space-x-3">
                {tool.icon}
                <span className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors">{tool.name}</span>
              </div>
              <Zap className="w-3.5 h-3.5 text-zinc-600 group-hover:text-yellow-500 transition-colors" />
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}
