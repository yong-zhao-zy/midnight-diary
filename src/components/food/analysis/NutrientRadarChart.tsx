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

const RADAR_KEYS: NutrientKey[] = [
  "protein_g", "fat_g", "carb_g", "fiber_g",
  "calcium_mg", "iron_mg", "zinc_mg",
  "vit_a_ugre", "vit_b1_mg", "vit_c_mg", "vit_d_ug",
];

interface Props {
  assessments: NutrientAssessment[];
}

export function NutrientRadarChart({ assessments }: Props) {
  const byKey = new Map(assessments.map((a) => [a.key, a]));
  const data = RADAR_KEYS.map((k) => {
    const a = byKey.get(k);
    return {
      nutrient: NUTRIENT_LABELS[k],
      rate: a ? Math.round(a.achievement_rate) : 0,
    };
  });

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} margin={{ top: 8, right: 24, left: 24, bottom: 8 }}>
          <PolarGrid stroke="rgba(255,255,255,0.1)" />
          <PolarAngleAxis dataKey="nutrient" tick={{ fontSize: 9, fill: "rgba(255,255,255,0.5)" }} />
          <PolarRadiusAxis domain={[0, 120]} tick={{ fontSize: 8, fill: "rgba(255,255,255,0.3)" }} tickCount={4} />
          <Tooltip
            contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
            formatter={(v) => [`${Number(v)}%`, "达成率"]}
          />
          <Radar dataKey="rate" stroke="#E0B84A" fill="#E0B84A" fillOpacity={0.25} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
