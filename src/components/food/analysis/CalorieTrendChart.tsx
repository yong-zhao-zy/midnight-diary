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
  /** 同周期体重记录（date 对齐）；无记录时不渲染次轴 */
  weightTrend?: Array<{ date: string; weight: number | null }>;
}

/**
 * 热量（左轴，金色）+ 体重（右轴，绿色，可选）双轴趋势。
 * 体重无任何记录时不画次坐标，仅留提示文案。
 */
export function CalorieTrendChart({ data, weightTrend = [] }: Props) {
  const weightByDate = new Map(weightTrend.map((w) => [w.date, w.weight]));
  const hasWeight = weightTrend.some((w) => w.weight != null);

  const formatted = data.map((d) => ({
    ...d,
    label: formatShort(d.date),
    weight: weightByDate.get(d.date) ?? null,
  }));

  // 显式计算纵轴刻度：0 起步、整数步长，保证刻度值与数据严格对应
  const maxKcal = Math.max(...data.map((d) => d.kcal), data[0]?.target ?? 0, 1);
  const step = maxKcal > 2000 ? 1000 : 500;
  const axisTop = Math.ceil(maxKcal / step) * step;
  const kcalTicks = Array.from({ length: axisTop / step + 1 }, (_, i) => i * step);

  return (
    <div>
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={formatted} margin={{ top: 8, right: hasWeight ? 4 : 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis
              yAxisId="kcal"
              domain={[0, axisTop]}
              ticks={kcalTicks}
              interval={0}
              tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
              tickLine={false}
              axisLine={false}
              width={44}
              tickFormatter={formatKcal}
            />
            {hasWeight && (
              <YAxis
                yAxisId="weight"
                orientation="right"
                domain={["auto", "auto"]}
                tick={{ fontSize: 10, fill: "rgba(110,231,183,0.55)" }}
                tickLine={false}
                axisLine={false}
                width={30}
                tickFormatter={(v) => Number(v).toFixed(1)}
              />
            )}
            <Tooltip
              contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: "rgba(255,255,255,0.6)" }}
              formatter={(v, name) =>
                name === "weight"
                  ? [`${Number(v)} kg`, "体重"]
                  : [`${Math.round(Number(v))} kcal`, "热量"]
              }
            />
            <ReferenceLine yAxisId="kcal" y={data[0]?.target ?? 0} stroke="rgba(224,184,74,0.4)" strokeDasharray="4 4" label={{ value: "目标", fill: "rgba(224,184,74,0.6)", fontSize: 9, position: "right" }} />
            <Line yAxisId="kcal" type="monotone" dataKey="kcal" name="kcal" stroke="#E0B84A" strokeWidth={2} dot={{ r: 2, fill: "#E0B84A" }} activeDot={{ r: 4 }} />
            {hasWeight && (
              <Line yAxisId="weight" type="monotone" dataKey="weight" name="weight" stroke="#6EE7B7" strokeWidth={2} dot={{ r: 2.5, fill: "#6EE7B7" }} activeDot={{ r: 4 }} connectNulls />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center gap-3 mt-1 text-[10px] text-muted/45">
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-3 rounded" style={{ background: "#E0B84A" }} />
          热量 kcal
        </span>
        {hasWeight && (
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-3 rounded" style={{ background: "#6EE7B7" }} />
            体重 kg（右轴）
          </span>
        )}
      </div>
      {!hasWeight && (
        <p className="text-[10px] text-muted/35 mt-1">
          周期内无体重记录 · 去「身体」tab 记录后可在同图展示曲线
        </p>
      )}
    </div>
  );
}

function formatShort(dateStr: string): string {
  const [, m, d] = dateStr.split("-").map(Number);
  return `${m}/${d}`;
}

/** 热量刻度：≥1000 显示 k 单位（1.2k），避免左轴被裁剪 */
function formatKcal(v: number): string {
  const n = Number(v);
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return `${Math.round(n)}`;
}
