"use client";

import {
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Tooltip,
} from "recharts";
import { NUTRIENT_LABELS, type NutrientKey } from "@/config/dri-config";
import type { NutrientAssessment } from "@/lib/nutrition-analysis";

interface Props {
  assessments: NutrientAssessment[];
  /** 本雷达展示的营养素（按分组传入） */
  keys: NutrientKey[];
  /** 线条/填充色 */
  color?: string;
  /** 紧凑模式：右侧小图用（小字号、去半径刻度） */
  compact?: boolean;
  /** 容器高度 class，覆盖默认（大图/小图均可调） */
  heightClass?: string;
}

/**
 * 达成率雷达。
 * - 白色虚线多边形 = 100% 达成基准线（高亮）
 * - 每个轴标签两行：营养素名 + 达成率小字（按评级着色）
 */
export function NutrientRadarChart({ assessments, keys, color = "#E0B84A", compact = false, heightClass }: Props) {
  const byKey = new Map(assessments.map((a) => [a.key, a]));
  // 无数据的项不进雷达（避免假 0%）
  const data = keys
    .filter((k) => byKey.get(k)?.has_data)
    .map((k) => {
      const a = byKey.get(k)!;
      return {
        nutrient: NUTRIENT_LABELS[k],
        rate: Math.round(a.achievement_rate),
        rating: a.rating,
        base: 100,
      };
    });

  if (data.length < 3) {
    return (
      <p className="text-xs text-muted/40 text-center py-8">
        本组营养素暂无可评数据（食物库未记录相应成分）
      </p>
    );
  }

  const nameTick = compact ? 7 : 9;
  const rateTick = compact ? 6.5 : 8;

  return (
    <div className={heightClass ?? (compact ? "h-36 w-full" : "h-52 w-full")}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} margin={{ top: compact ? 18 : 8, right: compact ? 10 : 24, left: compact ? 10 : 24, bottom: compact ? 10 : 8 }}>
          <PolarGrid stroke="rgba(255,255,255,0.1)" />
          <PolarAngleAxis
            dataKey="nutrient"
            tick={(props: PolarTickProps) => <RateTick {...props} nameSize={nameTick} rateSize={rateTick} />}
          />
          <PolarRadiusAxis
            domain={[0, 120]}
            tickCount={compact ? 3 : 4}
            tick={compact ? false : { fontSize: 8, fill: "rgba(255,255,255,0.3)" }}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
            formatter={(v, name) =>
              name === "base" ? null : [`${Number(v)}%`, "达成率"]
            }
          />
          {/* 100% 达成基准线（高亮白虚线） */}
          <Radar dataKey="base" stroke="rgba(255,255,255,0.45)" strokeWidth={1} strokeDasharray="4 3" fill="none" legendType="none" isAnimationActive={false} />
          <Radar dataKey="rate" stroke={color} fill={color} fillOpacity={0.25} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** 按评级着色的达成率小字 */
const RATE_COLORS: Record<string, string> = {
  sufficient: "#6EE7B7",
  borderline: "#FBBF24",
  deficient: "#FB7185",
  excessive: "#FB7185",
};

interface PolarTickProps {
  /** recharts 传入：value = 轴标签（营养素名），payload = 该轴完整数据 */
  payload?: { value?: string; payload?: { nutrient: string; rate: number; rating: string } };
  x?: number | string;
  y?: number | string;
  textAnchor?: string;
  nameSize?: number;
  rateSize?: number;
}

/** 轴标签：第一行营养素名，第二行达成率小字（按评级着色） */
function RateTick({ payload, x, y, textAnchor, nameSize = 9, rateSize = 8 }: PolarTickProps) {
  const data = payload?.payload;
  if (!data || x == null || y == null) return null;
  const rateColor = RATE_COLORS[data.rating] ?? "rgba(255,255,255,0.45)";
  const anchor = (textAnchor ?? "middle") as "middle" | "start" | "end";
  return (
    <text x={x} y={y} textAnchor={anchor} fill="rgba(255,255,255,0.55)">
      <tspan x={x} dy="0.6em" fontSize={nameSize}>
        {payload?.value ?? data.nutrient}
      </tspan>
      <tspan x={x} dy="1.15em" fontSize={rateSize} fill={rateColor}>
        {data.rate}%
      </tspan>
    </text>
  );
}
