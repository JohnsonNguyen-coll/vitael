"use client";

import React, { useMemo, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import type { Conversation } from "@/lib/backendApi";

type Props = {
  conversations: Conversation[];
  activeId: string | null;
  isLoading: boolean;
  canPersist: boolean;
  onNew: () => void;
  onSelect: (conversation: Conversation) => void;
  onDelete: (conversation: Conversation) => void;
};

function groupLabel(date: string) {
  const value = new Date(date);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  if (day === today) return "Today";
  if (day === today - 86_400_000) return "Yesterday";
  return "Earlier";
}

export function LeftSidebar({ conversations, activeId, isLoading, canPersist, onNew, onSelect, onDelete }: Props) {
  const [search, setSearch] = useState("");
  const groups = useMemo(() => {
    const filtered = conversations.filter((item) => item.title.toLowerCase().includes(search.toLowerCase()));
    return ["Today", "Yesterday", "Earlier"].map((label) => ({
      label,
      items: filtered.filter((item) => groupLabel(item.updated_at) === label),
    })).filter((group) => group.items.length > 0);
  }, [conversations, search]);

  return (
    <aside className="hidden h-full w-64 shrink-0 flex-col border-r border-white/[0.07] bg-[#090a0f] lg:flex">
      <div className="border-b border-white/[0.06] p-4">
        <button onClick={onNew} className="w-full rounded-lg border border-white/[0.09] bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-[#d7d9e1] transition hover:bg-white/[0.07]">
          New conversation
        </button>
      </div>
      <div className="p-3">
        <div className="relative">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search conversations" className="w-full rounded-lg border border-white/[0.07] bg-transparent px-3 py-2 text-xs text-white outline-none placeholder:text-[#555c70] focus:border-white/[0.14]" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {isLoading ? <div className="flex justify-center py-10"><Loader2 className="size-4 animate-spin text-[#A998FF]" /></div> : !canPersist ? <p className="px-3 py-5 text-xs leading-5 text-[#717995]">Connect your wallet to keep conversation history.</p> : groups.length === 0 ? <p className="px-3 py-5 text-xs text-[#717995]">No saved conversations yet.</p> : groups.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5f6782]">{group.label}</p>
            {group.items.map((conversation) => (
              <div key={conversation.id} className="group relative">
                <button onClick={() => onSelect(conversation)} className={`w-full rounded-lg px-3 py-2.5 pr-9 text-left text-xs transition ${activeId === conversation.id ? "bg-white/[0.07] text-white" : "text-[#81889c] hover:bg-white/[0.04] hover:text-white"}`}>
                  <span className="block truncate">{conversation.title}</span>
                </button>
                <button onClick={() => onDelete(conversation)} aria-label={`Delete ${conversation.title}`} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[#626a86] opacity-0 transition hover:text-red-300 group-hover:opacity-100"><Trash2 className="size-3.5" /></button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </aside>
  );
}
