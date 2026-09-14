"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface Props {
  data: Array<{ date: string; weight: number | null }>;
}

export function BodyTrendChart({ data }: Props) {
  const formatted = data
    .filter((d) => d.weight != null)
    .map((d) => ({ label: formatShort(d.date), weight: d.weight }));
  if (formatted.length === 0) {
    return <p className="text-xs text-muted/40 text-center py-8">周期内无体重记录</p>;
  }
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={formatted} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} tickLine={false} axisLine={false} width={36} />
          <Tooltip
            contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "rgba(255,255,255,0.6)" }}
            formatter={(v) => [`${Number(v)} kg`, "体重"]}
          />
          <Line type="monotone" dataKey="weight" stroke="#6EE7B7" strokeWidth={2} dot={{ r: 2, fill: "#6EE7B7" }} activeDot={{ r: 4 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function formatShort(dateStr: string): string {
  const [, m, d] = dateStr.split("-").map(Number);
  return `${m}/${d}`;
}
