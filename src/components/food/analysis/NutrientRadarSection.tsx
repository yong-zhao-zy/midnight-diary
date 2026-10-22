"use client";

import type { NutrientKey } from "@/config/dri-config";
import type { NutrientAssessment } from "@/lib/nutrition-analysis";
import { NutrientRadarChart } from "./NutrientRadarChart";

/** 三个雷达的分组：宏量 / 矿物质 / 维生素（左大右二布局，分析页与今日分析共用） */
const MACRO_RADAR_KEYS: NutrientKey[] = ["energy_kcal", "protein_g", "fat_g", "carb_g", "fiber_g"];
const MINERAL_RADAR_KEYS: NutrientKey[] = [
  "sodium_mg", "potassium_mg", "calcium_mg", "magnesium_mg", "iron_mg", "zinc_mg", "selenium_ug",
];
const VITAMIN_RADAR_KEYS: NutrientKey[] = [
  "vit_a_ugre", "vit_b1_mg", "vit_b2_mg", "vit_b6_mg", "vit_b12_ug", "vit_c_mg", "vit_d_ug", "vit_e_mg",
];

/**
 * 营养素达成率区块：左侧宏量大雷达，右栏上矿物质、下维生素。
 * 纯 SVG 雷达，轴旁两行标签（名称 + 按评级着色的达成率），白色虚线 = 100% 基准。
 */
export function NutrientRadarSection({ assessments }: { assessments: NutrientAssessment[] }) {
  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-3">
      <div className="mb-1">
        <p className="text-sm text-foreground/80">营养素达成率</p>
        <p className="text-xs text-muted/40">白色虚线 = 100% 达成基准 · 小字为达成率</p>
      </div>
      <div className="grid grid-cols-2 gap-1">
        <div>
          <p className="text-[10px] text-muted/50 mb-0">宏量</p>
          <NutrientRadarChart assessments={assessments} keys={MACRO_RADAR_KEYS} color="#E0B84A" size="lg" />
        </div>
        <div className="flex flex-col gap-0.5">
          <div>
            <p className="text-[10px] text-muted/50 mb-0">矿物质</p>
            <NutrientRadarChart assessments={assessments} keys={MINERAL_RADAR_KEYS} color="#6EE7B7" size="sm" />
          </div>
          <div>
            <p className="text-[10px] text-muted/50 mb-0">维生素</p>
            <NutrientRadarChart assessments={assessments} keys={VITAMIN_RADAR_KEYS} color="#7DD3FC" size="sm" />
          </div>
        </div>
      </div>
    </div>
  );
}
