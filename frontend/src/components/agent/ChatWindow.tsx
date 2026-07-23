"use client";

import React, { useEffect, useRef, useState } from "react";
import { Send, StopCircle } from "lucide-react";
import { useAccount } from "wagmi";
import { backendApi, type Conversation, type StoredMessage } from "@/lib/backendApi";
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
  const [error, setError] = useState<Error | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setMessages([]);
      setActiveConversationId(null);
      if (!address) {
        setConversations([]);
        return;
      }
      setIsLoadingHistory(true);
      backendApi.conversations(address)
        .then(({ items }) => { if (active) setConversations(items); })
        .catch((loadError) => console.error("Unable to load chat history", loadError))
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
  }, [messages]);

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
      if (activeConversationId === conversation.id) newChat();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError : new Error("Unable to delete conversation."));
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
        console.error("Unable to persist user message", saveError);
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
      if (!response.ok) throw new Error("The Vitael agent is temporarily unavailable.");
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
        }).catch((saveError) => console.error("Unable to persist assistant message", saveError));
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
      <LeftSidebar conversations={conversations} activeId={activeConversationId} isLoading={isLoadingHistory} canPersist={Boolean(address)} onNew={newChat} onSelect={(conversation) => void selectConversation(conversation)} onDelete={(conversation) => void deleteConversation(conversation)} />
      <section className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="pointer-events-none absolute left-0 right-0 top-0 z-10 h-8 bg-gradient-to-b from-[#0b0c12] to-transparent" />
        <div ref={scrollContainerRef} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10">
          <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col px-4 sm:px-6">
            {messages.length === 0 ? (
              <div className="relative z-10 flex flex-1 flex-col items-center justify-center py-8 text-center sm:py-10">
                <span className="mb-5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#777e92]">Vitael AI</span>
                <h1 className="mb-3 text-3xl font-semibold tracking-[-0.04em] text-[#f0f1f4] sm:text-4xl">How can I help?</h1>
                <p className="mb-8 max-w-md text-sm leading-6 text-[#7f8699]">Review positions, compare markets or prepare an onchain action.</p>
                <div className="grid w-full max-w-3xl grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {SUGGESTED_PROMPTS.map((prompt) => <button key={prompt} onClick={() => setLocalInput(prompt)} className="agent-prompt-card rounded-xl border border-white/[0.06] bg-black/20 px-4 py-3.5 text-left text-sm font-medium text-white/80 hover:text-white">{prompt}</button>)}
                </div>
              </div>
            ) : (
              <div className="flex-1 py-6 sm:py-8">
                <MessageList messages={messages} onStrategyStepSuccess={() => void sendMessage({ role: "user", content: "The previous strategy step has completed on-chain. Continue the active strategy with the next remaining step now. Do not ask for confirmation." })} />
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
                {isLoading ? <button type="button" onClick={() => abortRef.current?.abort()} aria-label="Stop response" className="flex size-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[#a7adbd]"><StopCircle className="size-4" /></button> : <button type="submit" aria-label="Send message" disabled={!localInput.trim()} className="flex size-9 items-center justify-center rounded-lg bg-[#d8d2ff] text-[#111219] transition-colors hover:bg-white disabled:bg-white/[0.06] disabled:text-white/20"><Send className="size-4" /></button>}
              </div>
            </form>
            <p className="mt-2.5 text-center text-[10px] font-medium text-[#737b98]">Vitael AI can make mistakes. Consider verifying important information.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
