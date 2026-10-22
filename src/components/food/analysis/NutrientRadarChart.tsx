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
}

export function NutrientRadarChart({ assessments, keys, color = "#E0B84A" }: Props) {
  const byKey = new Map(assessments.map((a) => [a.key, a]));
  // 无数据的项不进雷达（避免假 0%）
  const data = keys
    .filter((k) => byKey.get(k)?.has_data)
    .map((k) => {
      const a = byKey.get(k)!;
      return {
        nutrient: NUTRIENT_LABELS[k],
        rate: Math.round(a.achievement_rate),
      };
    });

  if (data.length < 3) {
    return (
      <p className="text-xs text-muted/40 text-center py-8">
        本组营养素暂无可评数据（食物库未记录相应成分）
      </p>
    );
  }

  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} margin={{ top: 8, right: 24, left: 24, bottom: 8 }}>
          <PolarGrid stroke="rgba(255,255,255,0.1)" />
          <PolarAngleAxis dataKey="nutrient" tick={{ fontSize: 9, fill: "rgba(255,255,255,0.5)" }} />
          <PolarRadiusAxis domain={[0, 120]} tick={{ fontSize: 8, fill: "rgba(255,255,255,0.3)" }} tickCount={4} />
          <Tooltip
            contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
            formatter={(v) => [`${Number(v)}%`, "达成率"]}
          />
          <Radar dataKey="rate" stroke={color} fill={color} fillOpacity={0.25} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
