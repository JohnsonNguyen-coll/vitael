'use client';
import React from 'react';
import { ChatWindow } from './ChatWindow';
import PageLayout from '../PageLayout';

import { motion } from 'framer-motion';
import { Bot, CircleCheck, Sparkles } from 'lucide-react';

export function AgentPage() {
  return (
    <PageLayout variant="app" showFooter={false}>
      <motion.main 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="relative z-10 mx-auto flex h-[calc(100dvh-72px)] w-full max-w-6xl box-border flex-col px-3 py-4 sm:px-6 sm:py-5 lg:px-8"
      >
        
        <div className="app-action-panel glass-panel relative flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-[1.6rem] shadow-2xl">
          <div className="absolute -top-32 -right-32 w-96 h-96 bg-[#A998FF]/5 rounded-full blur-3xl pointer-events-none overflow-hidden" />
          <div className="agent-app-bar relative z-20 flex h-16 shrink-0 items-center justify-between border-b border-white/[0.06] px-5 sm:px-6">
            <div className="flex items-center gap-3"><span className="agent-mini-logo"><Bot className="size-4" /></span><div><p className="text-sm font-semibold text-[#e2e3ec]">Vitael Intelligence</p><p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-[#717995]"><CircleCheck className="size-3 text-[#75dfb5]" /> Ready for onchain execution</p></div></div>
            <span className="hidden items-center gap-2 rounded-full border border-[#A998FF]/15 bg-[#A998FF]/[0.06] px-3 py-1.5 text-[10px] font-semibold text-[#a99aff] sm:flex"><Sparkles className="size-3" /> Context aware</span>
          </div>
          <ChatWindow />
        </div>
        
      </motion.main>
    </PageLayout>
  );
}
