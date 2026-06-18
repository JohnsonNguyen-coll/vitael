'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, StopCircle, Bot, Sparkles, Paperclip, ChevronDown } from 'lucide-react';
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
    args: any;
    result?: any;
  }>;
}

export function ChatWindow() {
  const { address } = useAccount();
  const [localInput, setLocalInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [messages, setMessages] = useState<Array<ChatMessage>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const sendMessage = async (msg: { role: string, content: string }) => {
    const newMsg: ChatMessage = { id: Date.now().toString(), role: msg.role as any, content: msg.content };
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
      const text = await response.text();
      setMessages([...newMessages, { id: Date.now().toString(), role: 'assistant', content: text }]);
    } catch (err: any) {
      setError(err);
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
    <div className="flex flex-col h-full w-full relative bg-transparent">
      
      {/* Top Gradient Fade (optional, for smooth scroll fade) */}
      <div className="absolute top-0 left-0 right-0 h-10 bg-gradient-to-b from-[#0A1428] to-transparent z-10 pointer-events-none" />

      {/* Main Scrollable Area */}
      <div className="flex-1 overflow-y-auto relative [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/20">
        <div className="max-w-3xl mx-auto px-4 w-full flex flex-col min-h-full">
          
          {messages.length === 0 ? (
            /* Welcome State */
            <div className="flex-1 flex flex-col items-center justify-center py-20 text-center relative z-10">
              <span className="text-xs uppercase tracking-widest text-[#00F5FF] font-bold mb-4 block">Arc Testnet · AI Agent</span>
              <div className="inline-flex items-center justify-center w-16 h-16 bg-[#00F5FF]/10 rounded-full mb-6 border border-[#00F5FF]/20 shadow-[0_0_30px_rgba(0,245,255,0.2)]">
                <Bot className="w-8 h-8 text-[#00F5FF]" />
              </div>
              <h1 className="text-4xl font-extrabold text-white mb-3 flex items-center justify-center">
                Ask Vitael <Sparkles className="w-6 h-6 text-[#00F5FF] ml-3" />
              </h1>
              <p className="text-[#8E9FB8] mt-2 text-sm max-w-md mb-10">
                Your AI-powered DeFi assistant.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl">
                {SUGGESTED_PROMPTS.map((prompt, i) => (
                  <button 
                    key={i}
                    onClick={() => { setLocalInput(prompt); }}
                    className="p-4 bg-black/20 hover:bg-black/40 border border-white/5 rounded-2xl text-left transition-colors text-white/80 hover:text-white text-sm font-medium"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Messages List */
            <div className="pt-10 pb-6 flex-1 flex flex-col justify-end">
               <MessageList messages={messages} />
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
      <div className="w-full shrink-0 bg-[#0A1428] pt-2 pb-6 px-4">
        <div className="max-w-3xl mx-auto w-full relative">
          <form 
            onSubmit={onSubmit} 
            className="flex relative bg-black/40 backdrop-blur-xl border border-white/10 focus-within:border-[#00F5FF]/30 rounded-2xl overflow-hidden transition-all shadow-2xl"
          >
            <button type="button" className="pl-4 pr-2 pt-4 text-[#8E9FB8] hover:text-[#00F5FF] transition-colors self-end pb-4">
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
                  className="w-9 h-9 bg-[#00F5FF] text-[#0A1428] hover:bg-white disabled:bg-white/10 disabled:text-white/30 rounded-full transition-colors flex items-center justify-center font-bold"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>
          </form>
          <p className="text-center text-[11px] text-[#8E9FB8] mt-3 font-medium">
            Vitael AI can make mistakes. Consider verifying important information.
          </p>
        </div>
      </div>
    </div>
  );
}
