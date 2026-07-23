"use client";

import React, { useMemo, useState } from "react";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";
import type { Conversation } from "@/lib/backendApi";

type Props = {
  conversations: Conversation[];
  activeId: string | null;
  isLoading: boolean;
  historyError: string | null;
  canPersist: boolean;
  onNew: () => void;
  onSelect: (conversation: Conversation) => void;
  onDelete: (conversation: Conversation) => Promise<void>;
  onClear: () => Promise<void>;
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

export function LeftSidebar({ conversations, activeId, isLoading, historyError, canPersist, onNew, onSelect, onDelete, onClear }: Props) {
  const [search, setSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Conversation | "all" | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const groups = useMemo(() => {
    const filtered = conversations.filter((item) => item.title.toLowerCase().includes(search.toLowerCase()));
    return ["Today", "Yesterday", "Earlier"].map((label) => ({
      label,
      items: filtered.filter((item) => groupLabel(item.updated_at) === label),
    })).filter((group) => group.items.length > 0);
  }, [conversations, search]);

  const confirmDelete = async () => {
    if (!pendingDelete || isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      if (pendingDelete === "all") await onClear();
      else await onDelete(pendingDelete);
      setPendingDelete(null);
    } catch {
      setDeleteError("Could not delete the conversation history. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

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
        {isLoading ? <div className="flex justify-center py-10"><Loader2 className="size-4 animate-spin text-[#A998FF]" /></div> : historyError ? <p className="px-3 py-5 text-xs leading-5 text-[#717995]">History is temporarily offline. You can still use the agent.</p> : !canPersist ? <p className="px-3 py-5 text-xs leading-5 text-[#717995]">Connect your wallet to keep conversation history.</p> : groups.length === 0 ? <p className="px-3 py-5 text-xs text-[#717995]">No saved conversations yet.</p> : groups.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5f6782]">{group.label}</p>
            {group.items.map((conversation) => (
              <div key={conversation.id} className="group relative">
                <button onClick={() => onSelect(conversation)} className={`w-full rounded-lg px-3 py-2.5 pr-9 text-left text-xs transition ${activeId === conversation.id ? "bg-white/[0.07] text-white" : "text-[#81889c] hover:bg-white/[0.04] hover:text-white"}`}>
                  <span className="block truncate">{conversation.title}</span>
                </button>
                <button onClick={() => setPendingDelete(conversation)} aria-label={`Delete ${conversation.title}`} className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-md px-1.5 py-1 text-[10px] text-[#737b92] opacity-0 transition hover:bg-red-400/10 hover:text-red-300 group-hover:opacity-100 focus:opacity-100"><Trash2 className="size-3" />Delete</button>
              </div>
            ))}
          </div>
        ))}
      </div>
      {canPersist && conversations.length > 0 && (
        <div className="border-t border-white/[0.06] p-3">
          <button onClick={() => setPendingDelete("all")} className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[#858da2] transition hover:bg-red-400/[0.07] hover:text-red-300">
            <Trash2 className="size-3.5" />
            Clear conversation history
          </button>
        </div>
      )}

      {pendingDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="delete-chat-title">
          <div className="w-full max-w-sm rounded-2xl border border-white/[0.1] bg-[#101117] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-red-400/10 text-red-300"><AlertTriangle className="size-5" /></div>
              <button onClick={() => setPendingDelete(null)} disabled={isDeleting} aria-label="Close" className="rounded-lg p-1.5 text-[#747c91] hover:bg-white/5 hover:text-white"><X className="size-4" /></button>
            </div>
            <h2 id="delete-chat-title" className="mt-4 text-base font-semibold text-white">
              {pendingDelete === "all" ? "Clear all conversation history?" : "Delete this conversation?"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#858da2]">
              {pendingDelete === "all"
                ? `This permanently deletes ${conversations.length} saved conversation${conversations.length === 1 ? "" : "s"} and every message inside them.`
                : `“${pendingDelete.title}” and every message inside it will be permanently deleted.`}
            </p>
            {deleteError && <p className="mt-3 text-xs text-red-300">{deleteError}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setPendingDelete(null)} disabled={isDeleting} className="rounded-lg border border-white/[0.08] px-4 py-2 text-xs font-medium text-[#bdc1cc] hover:bg-white/5 disabled:opacity-50">Cancel</button>
              <button onClick={() => void confirmDelete()} disabled={isDeleting} className="flex min-w-28 items-center justify-center gap-2 rounded-lg bg-red-400/90 px-4 py-2 text-xs font-semibold text-[#190a0d] hover:bg-red-300 disabled:opacity-50">
                {isDeleting && <Loader2 className="size-3.5 animate-spin" />}
                {pendingDelete === "all" ? "Clear history" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
