'use client';
import React from 'react';
import { ChatWindow } from './ChatWindow';
import { AgentIdentity } from './AgentIdentity';
import PageLayout from '../PageLayout';

import { motion } from 'framer-motion';

export function AgentPage() {
  return (
    <PageLayout variant="app">
      <motion.main 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="relative z-10 mx-auto flex min-h-[calc(100dvh-72px)] w-full max-w-6xl box-border flex-col px-3 py-4 sm:px-6 sm:py-6 lg:px-8"
      >
        
        <div className="agent-shell relative flex h-[calc(100dvh-120px)] min-h-[620px] max-h-[820px] w-full flex-none flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0b0c12] shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
          <div className="relative z-20 flex h-16 shrink-0 items-center justify-between border-b border-white/[0.07] px-5 sm:px-6">
            <AgentIdentity compact />
            <span className="hidden items-center gap-2 text-[11px] font-medium text-[#7f869a] sm:flex"><span className="size-1.5 rounded-full bg-[#72d7ad]" />Operational</span>
          </div>
          <ChatWindow />
        </div>
        
      </motion.main>
    </PageLayout>
  );
}
