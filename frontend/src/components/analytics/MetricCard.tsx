import React from "react";
import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  description?: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  isLoading?: boolean;
}

export function MetricCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  isLoading,
}: MetricCardProps) {
  return (
    <article className="glass-panel group flex min-h-40 flex-col justify-between rounded-2xl p-5 transition-all duration-300 hover:-translate-y-0.5">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-xs font-medium text-[#858da8]">
          {title}
        </h3>
        <div className="grid size-9 place-items-center rounded-xl border border-[#A998FF]/10 bg-[#A998FF]/[0.06] text-[#aa9aff] transition-colors group-hover:border-[#A998FF]/20">
          <Icon size={17} />
        </div>
      </div>

      <div className="space-y-1">
        {isLoading ? (
          <div className="h-8 w-1/2 bg-white/10 animate-pulse rounded"></div>
        ) : (
          <div className="marketing-display flex items-baseline gap-2 text-3xl font-semibold tracking-[-0.04em] text-white">
            {value}
            {trend && (
              <span
                className={`text-sm font-semibold ${
                  trend.isPositive ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {trend.isPositive ? "+" : "-"}
                {trend.value}
              </span>
            )}
          </div>
        )}
        {description && (
          <p className="mt-1.5 text-[11px] leading-5 text-[#6f7894]">{description}</p>
        )}
      </div>
    </article>
  );
}
