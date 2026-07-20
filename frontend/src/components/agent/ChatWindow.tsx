'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, StopCircle, Bot, Sparkles, Paperclip } from 'lucide-react';
import { MessageList } from './MessageList';
import { useAccount } from 'wagmi';

const SUGGESTED_PROMPTS = [
  "Analyze my portfolio",
  "Explain lending APY",
  "Compare DeFi strategies",
  "Find yield opportunities"
];

export interface ChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'data';
  content: string;
  toolInvocations?: Array<{
    toolCallId: string;
    toolName: string;
    state: string;
    args: Record<string, string>;
    result?: { to: string; data: string; value: string };
  }>;
  strategyExecution?: boolean;
}

export function ChatWindow() {
  const { address } = useAccount();
  const [localInput, setLocalInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<Array<ChatMessage>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const sendMessage = async (msg: { role: ChatMessage['role'], content: string }) => {
    const newMsg: ChatMessage = { id: Date.now().toString(), role: msg.role, content: msg.content };
    const newMessages = [...messages, newMsg];
    setMessages(newMessages);
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, userAddress: address }),
      });
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      setMessages([...newMessages, { 
        id: Date.now().toString(), 
        role: 'assistant', 
        content: data.text,
        toolInvocations: data.toolInvocations,
        strategyExecution: Boolean(data.strategyExecution),
      }]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err : new Error('Unable to reach the Vitael agent.'));
    } finally {
      setIsLoading(false);
    }
  };

  const stop = () => { /* no-op for now */ };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [localInput]);

  // Auto-scroll to bottom of the chat container
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const onSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!localInput.trim() || isLoading) return;
    sendMessage({ role: 'user', content: localInput });
    setLocalInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col bg-transparent">
      
      {/* Top Gradient Fade (optional, for smooth scroll fade) */}
      <div className="absolute top-0 left-0 right-0 h-10 bg-gradient-to-b from-[#0D0E1E] to-transparent z-10 pointer-events-none" />

      {/* Main Scrollable Area */}
      <div ref={scrollContainerRef} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 hover:[&::-webkit-scrollbar-thumb]:bg-white/20">
        <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col px-4 sm:px-6">
          
          {messages.length === 0 ? (
            /* Welcome State */
            <div className="relative z-10 flex flex-1 flex-col items-center justify-center py-8 text-center sm:py-10">
              <span className="app-eyebrow text-xs uppercase tracking-widest text-[#A998FF] font-bold mb-5 block">Arc Testnet · AI Agent</span>
              <div className="agent-orb mb-5 inline-flex size-16 items-center justify-center rounded-full border border-[#A998FF]/20 bg-[#A998FF]/10 shadow-[0_0_40px_rgba(169,152,255,0.22)]">
                <Bot className="size-7 text-[#b7a9ff]" />
              </div>
              <h1 className="app-page-title mb-2 flex items-center justify-center text-3xl text-white sm:text-4xl">
                Ask Vitael <Sparkles className="ml-3 size-5 text-[#A998FF]" />
              </h1>
              <p className="mb-7 mt-2 max-w-md text-sm text-[#8991AF]">
                Your AI-powered DeFi assistant.
              </p>

              <div className="grid w-full max-w-3xl grid-cols-1 gap-2.5 sm:grid-cols-2">
                {SUGGESTED_PROMPTS.map((prompt, i) => (
                  <button 
                    key={i}
                    onClick={() => { setLocalInput(prompt); }}
                    className="agent-prompt-card rounded-xl border border-white/[0.06] bg-black/20 px-4 py-3.5 text-left text-sm font-medium text-white/80 hover:text-white"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Messages List */
            <div className="flex-1 py-6 sm:py-8">
               <MessageList
                 messages={messages}
                 onStrategyStepSuccess={() => {
                   sendMessage({
                     role: 'user',
                     content: 'The previous strategy step has completed on-chain. Continue the active strategy with the next remaining step now. Do not ask for confirmation.',
                   });
                 }}
               />
               {error && (
                 <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm flex items-start gap-3">
                   <div className="shrink-0 mt-0.5">⚠️</div>
                   <div>
                     <span className="font-bold block mb-1">AI Agent Error:</span>
                     {error.message || "An unknown error occurred while communicating with the AI model."}
                   </div>
                 </div>
               )}
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="w-full shrink-0 bg-gradient-to-t from-[#0b0c1b] via-[#0b0c1b]/95 to-transparent px-4 pb-4 pt-3 sm:px-6">
        <div className="relative mx-auto w-full max-w-4xl">
          <form 
            onSubmit={onSubmit} 
            className="agent-composer flex relative bg-black/35 backdrop-blur-xl border border-white/10 focus-within:border-[#A998FF]/35 rounded-2xl overflow-hidden transition-all shadow-2xl"
          >
              <button type="button" className="pl-4 pr-2 pt-4 text-[#8991AF] hover:text-[#A998FF] transition-colors self-end pb-4">
              <Paperclip className="w-5 h-5" />
            </button>
            <textarea
              ref={textareaRef}
              value={localInput}
              onChange={(e) => setLocalInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message Vitael Agent..."
              rows={1}
              className="w-full bg-transparent text-white placeholder-white/20 py-4 px-2 focus:outline-none resize-none min-h-[56px] max-h-[200px] leading-relaxed"
            />
            <div className="pr-3 pl-2 pt-3 self-end pb-3">
              {isLoading ? (
                <button
                  type="button"
                  onClick={stop}
                  className="w-9 h-9 bg-white/5 border border-white/10 text-red-400 hover:bg-red-500/10 rounded-full transition-colors flex items-center justify-center"
                >
                  <StopCircle className="w-4 h-4 fill-current" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!localInput.trim()}
                  className="w-9 h-9 bg-[#A998FF] text-[#0D0E1E] hover:bg-white disabled:bg-white/10 disabled:text-white/30 rounded-full transition-colors flex items-center justify-center font-bold"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>
          </form>
          <p className="mt-2.5 text-center text-[10px] font-medium text-[#737b98]">
            Vitael AI can make mistakes. Consider verifying important information.
          </p>
        </div>
      </div>
    </div>
  );
}
