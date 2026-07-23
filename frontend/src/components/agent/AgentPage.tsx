'use client';
import React from 'react';
import { ChatWindow } from './ChatWindow';
import PageLayout from '../PageLayout';

import { motion } from 'framer-motion';

export function AgentPage() {
  return (
    <PageLayout variant="app" showFooter={false}>
      <motion.main 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="relative z-10 mx-auto flex h-[calc(100dvh-72px)] w-full max-w-6xl box-border flex-col px-3 py-4 sm:px-6 sm:py-5 lg:px-8"
      >
        
        <div className="agent-shell relative flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0b0c12] shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
          <div className="relative z-20 flex h-16 shrink-0 items-center justify-between border-b border-white/[0.07] px-5 sm:px-6">
            <div><p className="text-sm font-semibold tracking-[-0.01em] text-[#e7e8ee]">Vitael Intelligence</p><p className="mt-1 text-[11px] text-[#71778b]">Portfolio research and onchain execution</p></div>
            <span className="hidden items-center gap-2 text-[11px] font-medium text-[#7f869a] sm:flex"><span className="size-1.5 rounded-full bg-[#72d7ad]" />Operational</span>
          </div>
          <ChatWindow />
        </div>
        
      </motion.main>
    </PageLayout>
  );
}
