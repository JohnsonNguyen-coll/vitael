"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
} from "recharts";

export interface ChartDataPoint {
  name: string;
  [key: string]: string | number;
}

interface VolumeChartProps {
  data: ChartDataPoint[];
  keys: { key: string; color: string; name: string }[];
  type?: "bar" | "area";
  title: string;
}

export function VolumeChart({ data, keys, type = "bar", title }: VolumeChartProps) {
  return (
    <div className="glass-panel flex h-full flex-col rounded-2xl p-5 sm:p-6">
      <h3 className="mb-6 text-sm font-medium text-[#a4abc1]">
        {title}
      </h3>
      <div className="flex-1 w-full min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          {type === "bar" ? (
            <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#25283B" vertical={false} />
              <XAxis
                dataKey="name"
                stroke="#747C98"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#747C98"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) =>
                  value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value
                }
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#111323",
                  borderColor: "rgba(169,152,255,0.16)",
                  borderRadius: "12px",
                  color: "#fff",
                }}
                itemStyle={{ color: "#fff" }}
              />
              <Legend wrapperStyle={{ paddingTop: "20px" }} />
              {keys.map((k) => (
                <Bar
                  key={k.key}
                  dataKey={k.key}
                  name={k.name}
                  fill={k.color}
                  radius={[4, 4, 0, 0]}
                  barSize={40}
                />
              ))}
            </BarChart>
          ) : (
            <AreaChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                {keys.map((k) => (
                  <linearGradient
                    key={k.key}
                    id={`color${k.key}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor={k.color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={k.color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#25283B" vertical={false} />
              <XAxis
                dataKey="name"
                stroke="#747C98"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#747C98"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) =>
                  value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value
                }
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#111323",
                  borderColor: "rgba(169,152,255,0.16)",
                  borderRadius: "12px",
                  color: "#fff",
                }}
                itemStyle={{ color: "#fff" }}
              />
              <Legend wrapperStyle={{ paddingTop: "20px" }} />
              {keys.map((k) => (
                <Area
                  key={k.key}
                  type="monotone"
                  dataKey={k.key}
                  name={k.name}
                  stroke={k.color}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill={`url(#color${k.key})`}
                />
              ))}
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
