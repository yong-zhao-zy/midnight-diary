"use client";

import type { NutrientKey } from "@/config/dri-config";
import { NUTRIENT_LABELS } from "@/config/dri-config";
import type { NutrientAssessment } from "@/lib/nutrition-analysis";
import { NutrientRadarChart } from "./NutrientRadarChart";

const MACRO_RADAR_KEYS: NutrientKey[] = ["energy_kcal", "protein_g", "fat_g", "carb_g", "fiber_g"];
const MINERAL_RADAR_KEYS: NutrientKey[] = [
  "sodium_mg", "potassium_mg", "calcium_mg", "magnesium_mg", "iron_mg", "zinc_mg", "selenium_ug",
];
const VITAMIN_RADAR_KEYS: NutrientKey[] = [
  "vit_a_ugre", "vit_b1_mg", "vit_b2_mg", "vit_b6_mg", "vit_b12_ug", "vit_c_mg", "vit_d_ug", "vit_e_mg",
];

export interface OverviewCalorieData {
  /** 每日热量目标 */
  targetKcal: number | null;
  /** 实际 / 日均摄入 */
  intakeKcal: number | null;
  /** 摄入行文案：单日「已摄入」、周期「日均摄入」 */
  intakeLabel?: string;
  /** 左下角克数三行（蛋白质/碳水/脂肪） */
  macros: Array<{ label: string; intake: number; target: number }>;
}

interface Props {
  calorie: OverviewCalorieData | null;
  /** null = 还没算出来 / 无记录，雷达区显示占位 */
  assessments: NutrientAssessment[] | null;
}

/**
 * 2×2 概览四宫格：左上热量环 + 克数文字，右上宏量雷达、左下矿物质雷达、右下维生素雷达。
 * 【饮食】单日 / 【分析】周期日均 两处共用。
 */
export function NutrientOverviewGrid({ calorie, assessments }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="rounded-2xl bg-surface-2 border border-line-2 p-3">
        <CalorieCard data={calorie} />
      </div>
      <RadarCell title="宏量" assessments={assessments} keys={MACRO_RADAR_KEYS} color="#E0B84A" />
      <RadarCell title="矿物质" assessments={assessments} keys={MINERAL_RADAR_KEYS} color="#6EE7B7" />
      <RadarCell title="维生素" assessments={assessments} keys={VITAMIN_RADAR_KEYS} color="#7DD3FC" />
    </div>
  );
}

function RadarCell({
  title,
  assessments,
  keys,
  color,
}: {
  title: string;
  assessments: NutrientAssessment[] | null;
  keys: NutrientKey[];
  color: string;
}) {
  return (
    <div className="rounded-2xl bg-surface-2 border border-line-2 px-1 pt-2 pb-1">
      <p className="text-[10px] text-ink-2/60 mb-0 pl-2.5">{title}</p>
      {assessments ? (
        <NutrientRadarChart assessments={assessments} keys={keys} color={color} size="md" />
      ) : (
        <p className="text-[11px] text-ink-2/50 text-center py-[62px]">暂无数据</p>
      )}
    </div>
  );
}

/** 热量环卡：剩余/超出 kcal + 目标/摄入 + 宏量克数三行 */
function CalorieCard({ data }: { data: OverviewCalorieData | null }) {
  if (!data) {
    return <p className="text-[11px] text-ink-2/50 text-center leading-[128px]">暂无数据</p>;
  }

  const { targetKcal, intakeKcal, intakeLabel = "已摄入", macros } = data;
  const delta = targetKcal != null && intakeKcal != null ? targetKcal - intakeKcal : null;
  const over = delta != null && delta < 0;
  const ringPct =
    targetKcal != null && targetKcal > 0 && intakeKcal != null
      ? Math.min(intakeKcal / targetKcal, 1)
      : 0;
  const RADIUS = 26;
  const CIRC = 2 * Math.PI * RADIUS;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3">
        {/* 环随卡片宽度自适应（PC 模式下与雷达一样变大）：数字/文字画进 SVG，随 viewBox 等比缩放 */}
        <div className="shrink-0 w-[42%] max-w-[136px] aspect-square">
          <svg viewBox="0 0 64 64" className="h-full w-full">
            <circle cx="32" cy="32" r={RADIUS} fill="none" style={{ stroke: "var(--t-line-1)" }} strokeWidth="6" />
            <circle
              cx="32"
              cy="32"
              r={RADIUS}
              fill="none"
              stroke={over ? "rgb(251 113 133)" : "rgb(245 178 75)"}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${ringPct * CIRC} ${CIRC}`}
              transform="rotate(-90 32 32)"
              className="transition-all duration-500"
            />
            <text
              x="32"
              y="30"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="14"
              fontWeight="600"
              fill={over ? "rgb(251 113 133)" : "rgb(245 178 75)"}
            >
              {delta != null ? Math.round(delta) : "—"}
            </text>
            <text x="32" y="41" textAnchor="middle" fontSize="6" style={{ fill: "var(--t-ink-2)" }}>
              {over ? "超出 kcal" : "剩余 kcal"}
            </text>
          </svg>
        </div>

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-baseline justify-between gap-1 text-[11px]">
            <span className="text-ink-2/70">目标</span>
            <span className="text-ink/80">{targetKcal != null ? `${Math.round(targetKcal)} kcal` : "—"}</span>
          </div>
          <div className="flex items-baseline justify-between gap-1 text-[11px]">
            <span className="text-ink-2/70">{intakeLabel}</span>
            <span className="text-ink/80">{intakeKcal != null ? `${Math.round(intakeKcal)} kcal` : "—"}</span>
          </div>
        </div>
      </div>

      <div className="mt-auto pt-2.5 border-t border-line-1 space-y-1">
        {macros.map((m) => {
          const over = m.target > 0 && m.intake > m.target;
          return (
            <div key={m.label} className="flex items-baseline justify-between gap-1 text-[10px]">
              <span className="text-ink-2/70">{m.label}</span>
              <span className={over ? "text-rose-400/90" : "text-ink-2/60"}>
                {round1(m.intake)}/{round1(m.target)} g
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** 便捷组装：从 assessments 里取某营养素的 日均摄入 / 目标 */
export function macroLineFromAssessments(
  assessments: NutrientAssessment[],
  key: NutrientKey
): { label: string; intake: number; target: number } {
  const a = assessments.find((x) => x.key === key);
  return { label: NUTRIENT_LABELS[key], intake: a?.intake ?? 0, target: a?.dri ?? 0 };
}
