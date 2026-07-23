import React from "react";

type AgentMarkProps = {
  compact?: boolean;
  active?: boolean;
};

export function AgentMark({ compact = false, active = true }: AgentMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={`agent-mark relative grid shrink-0 place-items-center rounded-xl border border-white/[0.1] bg-[#171821] font-semibold text-[#d8d3ee] ${
        compact ? "size-7 text-[11px]" : "size-11 text-sm"
      }`}
    >
      V
      {active && <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full border-2 border-[#0b0c12] bg-[#72d7ad]" />}
    </span>
  );
}

export function AgentIdentity({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3 text-left">
      <AgentMark compact={compact} />
      <div>
        <p className={`${compact ? "text-xs" : "text-sm"} font-semibold tracking-[-0.01em] text-[#e7e8ee]`}>
          Vitael Intelligence
        </p>
        <p className={`${compact ? "text-[10px]" : "text-[11px]"} mt-0.5 text-[#71778b]`}>
          Onchain research & execution agent
        </p>
      </div>
    </div>
  );
}
