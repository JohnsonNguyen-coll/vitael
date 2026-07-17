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
    <div className="bg-[#1C1F26]/50 backdrop-blur-xl border border-white/5 rounded-2xl p-6 flex flex-col justify-between hover:bg-[#1C1F26]/80 transition-all duration-300 shadow-xl group">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-[#A0AEC0] font-medium text-sm tracking-wide">
          {title}
        </h3>
        <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg group-hover:scale-110 transition-transform duration-300">
          <Icon size={20} />
        </div>
      </div>

      <div className="space-y-1">
        {isLoading ? (
          <div className="h-8 w-1/2 bg-white/10 animate-pulse rounded"></div>
        ) : (
          <div className="text-2xl font-bold text-white tracking-tight flex items-baseline gap-2">
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
          <p className="text-xs text-[#718096]">{description}</p>
        )}
      </div>
    </div>
  );
}
