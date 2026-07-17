'use client';
import React from 'react';
import { ChatWindow } from './ChatWindow';
import PageLayout from '../PageLayout';

import { motion } from 'framer-motion';

export function AgentPage() {
  return (
    <PageLayout variant="app">
      <motion.main 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 h-[calc(100vh-80px)] flex flex-col"
      >
        
        <div className="flex-1 w-full glass-panel rounded-3xl shadow-2xl overflow-hidden flex flex-col relative h-full">
          <div className="absolute -top-32 -right-32 w-96 h-96 bg-[#00F5FF]/5 rounded-full blur-3xl pointer-events-none overflow-hidden" />
          <ChatWindow />
        </div>
        
      </motion.main>
    </PageLayout>
  );
}
