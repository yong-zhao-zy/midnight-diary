"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from "recharts";

interface Props {
  data: Array<{ date: string; kcal: number; target: number }>;
}

export function CalorieTrendChart({ data }: Props) {
  const formatted = data.map((d) => ({ ...d, label: formatShort(d.date) }));
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={formatted} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} tickLine={false} axisLine={false} width={36} />
          <Tooltip
            contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "rgba(255,255,255,0.6)" }}
            formatter={(v) => [`${Math.round(Number(v))} kcal`, ""]}
          />
          <ReferenceLine y={data[0]?.target ?? 0} stroke="rgba(224,184,74,0.4)" strokeDasharray="4 4" label={{ value: "目标", fill: "rgba(224,184,74,0.6)", fontSize: 9, position: "right" }} />
          <Line type="monotone" dataKey="kcal" stroke="#E0B84A" strokeWidth={2} dot={{ r: 2, fill: "#E0B84A" }} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function formatShort(dateStr: string): string {
  const [, m, d] = dateStr.split("-").map(Number);
  return `${m}/${d}`;
}
