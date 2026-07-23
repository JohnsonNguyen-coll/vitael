"use client";

import React, { useEffect, useRef, useState } from "react";
import { Send, StopCircle } from "lucide-react";
import { useAccount } from "wagmi";
import { backendApi, type Conversation, type StoredMessage } from "@/lib/backendApi";
import { AgentMark } from "./AgentIdentity";
import { LeftSidebar } from "./LeftSidebar";
import { MessageList } from "./MessageList";

const SUGGESTED_PROMPTS = ["Analyze my portfolio", "Explain lending APY", "Compare DeFi strategies", "Find yield opportunities"];

export interface ChatMessage {
  id: string;
  role: "system" | "user" | "assistant" | "data";
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

type SavedAgentPart = {
  type?: string;
  toolInvocations?: ChatMessage["toolInvocations"];
  strategyExecution?: boolean;
};

function fromStored(message: StoredMessage): ChatMessage {
  const part = (message.parts[0] ?? {}) as SavedAgentPart;
  return {
    id: message.id,
    role: message.role === "tool" ? "data" : message.role,
    content: message.content ?? "",
    toolInvocations: part.type === "vitael_agent" ? part.toolInvocations : undefined,
    strategyExecution: part.type === "vitael_agent" ? part.strategyExecution : undefined,
  };
}

export function ChatWindow() {
  const { address } = useAccount();
  const [localInput, setLocalInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setMessages([]);
      setActiveConversationId(null);
      setHistoryError(null);
      if (!address) {
        setConversations([]);
        return;
      }
      setIsLoadingHistory(true);
      backendApi.conversations(address)
        .then(({ items }) => { if (active) setConversations(items); })
        .catch(() => { if (active) setHistoryError("History unavailable"); })
        .finally(() => { if (active) setIsLoadingHistory(false); });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [address]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [localInput]);

  useEffect(() => {
    if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
  }, [messages, isLoading]);

  const selectConversation = async (conversation: Conversation) => {
    if (!address || isLoading) return;
    setActiveConversationId(conversation.id);
    setIsLoadingHistory(true);
    setError(null);
    try {
      const { items } = await backendApi.messages(conversation.id, address);
      setMessages(items.map(fromStored));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError : new Error("Unable to load conversation."));
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const newChat = () => {
    if (isLoading) return;
    setActiveConversationId(null);
    setMessages([]);
    setError(null);
    setLocalInput("");
  };

  const deleteConversation = async (conversation: Conversation) => {
    if (!address) return;
    try {
      await backendApi.deleteConversation(conversation.id, address);
      setConversations((current) => current.filter((item) => item.id !== conversation.id));
      if (activeConversationId === conversation.id) {
        abortRef.current?.abort();
        setIsLoading(false);
        setActiveConversationId(null);
        setMessages([]);
        setError(null);
        setLocalInput("");
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError : new Error("Unable to delete conversation."));
      throw deleteError;
    }
  };

  const clearConversationHistory = async () => {
    if (!address) return;
    try {
      await backendApi.clearConversationHistory(address);
      abortRef.current?.abort();
      setIsLoading(false);
      setConversations([]);
      setActiveConversationId(null);
      setMessages([]);
      setError(null);
      setLocalInput("");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError : new Error("Unable to clear conversation history."));
      throw deleteError;
    }
  };

  const sendMessage = async (message: { role: ChatMessage["role"]; content: string }) => {
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: message.role, content: message.content };
    const requestMessages = [...messages, userMessage];
    setMessages(requestMessages);
    setIsLoading(true);
    setError(null);

    let conversationId = activeConversationId;
    if (address) {
      try {
        if (!conversationId) {
          const title = message.content.trim().replace(/\s+/g, " ").slice(0, 72) || "New conversation";
          const { conversation } = await backendApi.createConversation(address, title);
          conversationId = conversation.id;
          setActiveConversationId(conversation.id);
          setConversations((current) => [conversation, ...current]);
        }
        await backendApi.appendMessage(conversationId, address, { role: "user", content: message.content });
      } catch (saveError) {
        console.warn("Unable to persist user message", saveError);
      }
    }

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ messages: requestMessages, userAddress: address }),
      });
      if (!response.ok) {
        const failure = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(failure?.error || "The Vitael agent is temporarily unavailable.");
      }
      const data = await response.json();
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.text,
        toolInvocations: data.toolInvocations,
        strategyExecution: Boolean(data.strategyExecution),
      };
      setMessages([...requestMessages, assistantMessage]);
      if (address && conversationId) {
        await backendApi.appendMessage(conversationId, address, {
          role: "assistant",
          content: assistantMessage.content,
          parts: [{ type: "vitael_agent", toolInvocations: assistantMessage.toolInvocations, strategyExecution: assistantMessage.strategyExecution }],
        }).catch((saveError) => console.warn("Unable to persist assistant message", saveError));
      }
    } catch (sendError) {
      if ((sendError as Error).name !== "AbortError") setError(sendError instanceof Error ? sendError : new Error("Unable to reach the Vitael agent."));
    } finally {
      abortRef.current = null;
      setIsLoading(false);
    }
  };

  const onSubmit = (event?: React.FormEvent) => {
    event?.preventDefault();
    const content = localInput.trim();
    if (!content || isLoading) return;
    setLocalInput("");
    void sendMessage({ role: "user", content });
  };

  return (
    <div className="relative flex min-h-0 w-full flex-1 bg-transparent">
      <LeftSidebar conversations={conversations} activeId={activeConversationId} isLoading={isLoadingHistory} historyError={historyError} canPersist={Boolean(address)} onNew={newChat} onSelect={(conversation) => void selectConversation(conversation)} onDelete={deleteConversation} onClear={clearConversationHistory} />
      <section className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="pointer-events-none absolute left-0 right-0 top-0 z-10 h-8 bg-gradient-to-b from-[#0b0c12] to-transparent" />
        <div ref={scrollContainerRef} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10">
          <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col px-4 sm:px-6">
            {messages.length === 0 ? (
              <div className="relative z-10 flex flex-1 flex-col items-center justify-center py-8 text-center sm:py-10">
                <div className="mb-6 flex flex-col items-center gap-3">
                  <AgentMark />
                  <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.02em] text-[#9ba1b2]">
                    <span className="size-1.5 rounded-full bg-[#72d7ad]" />
                    Vitael Intelligence
                  </div>
                </div>
                <h1 className="mb-3 text-3xl font-semibold tracking-[-0.04em] text-[#f0f1f4] sm:text-4xl">How can I help?</h1>
                <p className="mb-8 max-w-md text-sm leading-6 text-[#7f8699]">Review positions, compare markets or prepare an onchain action.</p>
                <div className="grid w-full max-w-3xl grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {SUGGESTED_PROMPTS.map((prompt) => <button key={prompt} onClick={() => setLocalInput(prompt)} className="agent-prompt-card rounded-xl border border-white/[0.06] bg-black/20 px-4 py-3.5 text-left text-sm font-medium text-white/80 hover:text-white">{prompt}</button>)}
                </div>
              </div>
            ) : (
              <div className="flex-1 py-6 sm:py-8">
                <MessageList messages={messages} onStrategyStepSuccess={() => void sendMessage({ role: "user", content: "The previous strategy step has completed on-chain. Continue the active strategy with the next remaining step now. Do not ask for confirmation." })} />
                {isLoading && (
                  <div className="mt-2 flex items-start gap-3" role="status" aria-live="polite">
                    <AgentMark compact />
                    <div className="rounded-2xl rounded-tl-md border border-white/[0.07] bg-white/[0.025] px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-[#aeb2c0]">Analyzing context</span>
                        <span className="flex items-center gap-1" aria-hidden="true">
                          <i className="agent-thinking-dot size-1 rounded-full bg-[#9c91c8]" />
                          <i className="agent-thinking-dot size-1 rounded-full bg-[#9c91c8]" />
                          <i className="agent-thinking-dot size-1 rounded-full bg-[#9c91c8]" />
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] text-[#666e82]">Reviewing markets, positions and available actions</p>
                    </div>
                  </div>
                )}
                {error && <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300"><span className="mb-1 block font-bold">AI Agent Error</span>{error.message}</div>}
              </div>
            )}
          </div>
        </div>
        <div className="w-full shrink-0 border-t border-white/[0.05] bg-[#0b0c12] px-4 pb-4 pt-3 sm:px-6">
          <div className="relative mx-auto w-full max-w-4xl">
            <form onSubmit={onSubmit} className="agent-composer relative flex overflow-hidden rounded-xl border border-white/[0.1] bg-[#111219] transition-colors focus-within:border-white/[0.2]">
              <textarea ref={textareaRef} value={localInput} onChange={(event) => setLocalInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); onSubmit(); } }} placeholder="Ask Vitael..." rows={1} className="min-h-[54px] max-h-[200px] w-full resize-none bg-transparent py-4 pl-4 pr-2 text-sm leading-relaxed text-white outline-none placeholder:text-[#555c70]" />
              <div className="self-end pb-3 pl-2 pr-3 pt-3">
                {isLoading ? <button type="button" onClick={() => abortRef.current?.abort()} aria-label="Stop response" className="flex h-9 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-semibold text-[#b8bdca] hover:bg-white/[0.08]"><StopCircle className="size-3.5" />Stop</button> : <button type="submit" aria-label="Send message" disabled={!localInput.trim()} className="flex h-9 items-center justify-center gap-2 rounded-lg bg-[#d8d2ff] px-3 text-xs font-semibold text-[#111219] transition-colors hover:bg-white disabled:bg-white/[0.06] disabled:text-white/20"><Send className="size-3.5" />Send</button>}
              </div>
            </form>
            <p className="mt-2.5 text-center text-[10px] font-medium text-[#737b98]">Vitael AI can make mistakes. Consider verifying important information.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
