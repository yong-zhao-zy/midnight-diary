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

/** 轴数据项（写入 recharts data 的结构） */
interface TickData {
  nutrient: string;
  rate: number;
  rating: string;
  base: number;
}

/**
 * 达成率雷达。
 * - 白色虚线多边形 = 100% 达成基准线（高亮）
 * - 每个轴标签两行：营养素名 + 达成率小字（按评级着色）
 */
export function NutrientRadarChart({ assessments, keys, color = "#E0B84A", compact = false, heightClass }: Props) {
  const byKey = new Map(assessments.map((a) => [a.key, a]));
  // 无数据的项不进雷达（避免假 0%）
  const data: TickData[] = keys
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

  const nameTick = compact ? 7.5 : 10;
  const rateTick = compact ? 7 : 9;

  return (
    <div className={heightClass ?? (compact ? "h-36 w-full" : "h-52 w-full")}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} margin={{ top: compact ? 20 : 10, right: compact ? 8 : 14, left: compact ? 8 : 14, bottom: compact ? 12 : 10 }}>
          <PolarGrid stroke="rgba(255,255,255,0.1)" />
          <PolarAngleAxis
            dataKey="nutrient"
            tick={(props: unknown) => <RateTick {...(props as Record<string, unknown>)} nameSize={nameTick} rateSize={rateTick} />}
          />
          {/* 半径刻度数字全部隐藏：达成率直接标在各轴旁 */}
          <PolarRadiusAxis domain={[0, 120]} tick={false} axisLine={false} />
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

/**
 * 轴标签：第一行营养素名，第二行达成率小字（按评级着色）。
 * recharts 极坐标 tick 的 payload 形态随版本不同：
 *   - { value: 轴名, payload: 数据项 }
 *   - 或直接展开的数据项（含 value 字段）
 * 两种都兼容，取不到数据时不渲染（不抛错）。
 */
function RateTick(props: {
  payload?: unknown;
  x?: number | string;
  y?: number | string;
  textAnchor?: string;
  nameSize?: number;
  rateSize?: number;
}) {
  const { x, y, textAnchor, nameSize = 9, rateSize = 8 } = props;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = props.payload as any;
  const data: Partial<TickData> | undefined =
    raw && typeof raw === "object" && "rate" in raw ? raw : raw?.payload;
  if (!data || data.rate == null || x == null || y == null) return null;
  const name = (typeof raw?.value === "string" ? raw.value : undefined) ?? data.nutrient;
  const rateColor = RATE_COLORS[data.rating ?? ""] ?? "rgba(255,255,255,0.45)";
  const anchor = (textAnchor ?? "middle") as "middle" | "start" | "end";
  return (
    <text x={x} y={y} textAnchor={anchor} fill="rgba(255,255,255,0.6)">
      <tspan x={x} dy="0.6em" fontSize={nameSize}>
        {name}
      </tspan>
      <tspan x={x} dy="1.15em" fontSize={rateSize} fill={rateColor}>
        {data.rate}%
      </tspan>
    </text>
  );
}
