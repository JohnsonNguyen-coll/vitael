'use client';
import React, { useState } from 'react';
import { MessageSquarePlus, MessageSquare, MoreHorizontal, Pin, Trash2, Edit2, Search } from 'lucide-react';

export function LeftSidebar() {
  const [search, setSearch] = useState('');

  const history = [
    { id: '1', title: 'Portfolio Analysis & APR check', date: 'Today' },
    { id: '2', title: 'Swap 100 USDC to Base', date: 'Today' },
    { id: '3', title: 'Lending APY differences', date: 'Yesterday' },
    { id: '4', title: 'Yield farming strategies', date: 'Previous 7 Days' },
  ];

  return (
    <div className="w-64 h-full flex flex-col border-r border-zinc-800/50 bg-zinc-900/30 overflow-hidden shrink-0 hidden lg:flex">
      
      <div className="p-4 border-b border-zinc-800/50">
        <button className="w-full flex items-center justify-between bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl px-4 py-2.5 transition-colors">
          <span className="flex items-center"><MessageSquarePlus className="w-4 h-4 mr-2" /> New Chat</span>
        </button>
      </div>

      <div className="p-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input 
            type="text"
            placeholder="Search chats..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-zinc-800/50 border border-zinc-800 focus:border-zinc-700 rounded-lg pl-9 pr-3 py-1.5 text-sm text-zinc-300 placeholder:text-zinc-500 focus:outline-none transition-colors"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-6 scrollbar-thin">
        {/* Today */}
        <div>
          <h3 className="px-3 text-xs font-semibold text-zinc-500 mb-2 mt-2">Today</h3>
          <ul className="space-y-0.5">
            {history.filter(h => h.date === 'Today').map(chat => (
              <li key={chat.id} className="group relative">
                <button className="w-full flex items-center text-left text-sm text-zinc-300 hover:bg-zinc-800/50 rounded-lg px-3 py-2 transition-colors">
                  <MessageSquare className="w-4 h-4 mr-2 text-zinc-500 shrink-0" />
                  <span className="truncate pr-4">{chat.title}</span>
                </button>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex items-center bg-gradient-to-l from-zinc-800/80 via-zinc-800/80 to-transparent pl-4">
                  <button className="text-zinc-400 hover:text-white p-1"><MoreHorizontal className="w-4 h-4" /></button>
                </div>
              </li>
            ))}
          </ul>
        </div>
        
        {/* Yesterday */}
        <div>
          <h3 className="px-3 text-xs font-semibold text-zinc-500 mb-2">Yesterday</h3>
          <ul className="space-y-0.5">
            {history.filter(h => h.date === 'Yesterday').map(chat => (
              <li key={chat.id} className="group relative">
                <button className="w-full flex items-center text-left text-sm text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800/50 rounded-lg px-3 py-2 transition-colors">
                  <MessageSquare className="w-4 h-4 mr-2 text-zinc-600 shrink-0" />
                  <span className="truncate pr-4">{chat.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

    </div>
  );
}
