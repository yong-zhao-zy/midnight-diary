/**
 * 单食物营养评价 — 纯 JS 规则引擎（无副作用、无网络调用）
 *
 * 评价维度：
 * 1. 能量密度：低/中/高（按 100g 热量）
 * 2. 宏量角色：优质蛋白源 / 高纤 / 高碳 / 高脂
 * 3. 微量亮点 top3：占 DRI ≥30% 的微量营养素降序取前 3
 * 4. 警戒项：钠偏高 / 纤维偏低
 *
 * 单食物评价不套"达成率"概念（一天吃很多食物，单食物占比无意义），
 * 而是用标签式描述：该食物每 100g 的营养素占日需 DRI 的比例，标"亮点"。
 */

import {
  NUTRIENT_LABELS,
  NUTRIENT_UNITS,
  MICRO_NUTRIENTS,
  type NutrientKey,
  type DRIEntry,
} from "@/config/dri-config";
import type { FoodRow } from "./food-service";

export type TagTone = "good" | "warn" | "neutral";

export interface FoodTag {
  label: string;
  tone: TagTone;
  detail?: string;
}

export interface FoodEvaluation {
  energy_density: { level: "low" | "medium" | "high"; label: string; detail: string };
  macro_roles: FoodTag[];
  micro_highlights: FoodTag[];
  warnings: FoodTag[];
  /** 扁平化所有标签，供 UI 简单展示 */
  all_tags: FoodTag[];
}

/** 取食物某营养素每 100g 的值 */
function nutrientValue(food: FoodRow, key: NutrientKey): number | null {
  const v = (food as unknown as Record<NutrientKey, number | null>)[key];
  return v == null || Number.isNaN(v) ? null : v;
}

/** 占 DRI 的百分比（无 DRI 或无值返回 null） */
function pctOfDRI(food: FoodRow, key: NutrientKey, dri: DRIEntry | null): number | null {
  const v = nutrientValue(food, key);
  if (v == null) return null;
  const d = dri ? (dri as unknown as Record<NutrientKey, number>)[key] : 0;
  if (!d || d <= 0) return null;
  return (v / d) * 100;
}

/**
 * 评价单个食物
 * @param food 食物行（每 100g 营养素）
 * @param dri 用户个性化 DRI（无画像时传 null，微量亮点按通用 DRI 判断）
 */
export function evaluateFood(food: FoodRow, dri: DRIEntry | null): FoodEvaluation {
  const energy = food.energy_kcal ?? 0;
  const protein = food.protein_g ?? 0;
  const fat = food.fat_g ?? 0;
  const carb = food.carb_g ?? 0;
  const fiber = food.fiber_g ?? 0;

  // 1. 能量密度
  let level: "low" | "medium" | "high" = "medium";
  if (energy < 100) level = "low";
  else if (energy > 250) level = "high";
  const energyLabel = level === "low" ? "低能量" : level === "high" ? "高能量" : "中等能量";
  const energyDetail = `${Math.round(energy)} kcal/100g · ${level === "low" ? "适合多吃、饱腹感强" : level === "high" ? "注意控量" : "适量食用"}`;

  // 2. 宏量角色
  const macro_roles: FoodTag[] = [];
  // 优质蛋白源：蛋白质占比（按供能比）≥20% 且绝对值 ≥8g/100g
  const proteinCalories = protein * 4;
  const totalMacroCal = proteinCalories + fat * 9 + carb * 4;
  if (totalMacroCal > 0 && proteinCalories / totalMacroCal >= 0.2 && protein >= 8) {
    macro_roles.push({
      label: "优质蛋白源",
      tone: "good",
      detail: `蛋白质 ${round1(protein)}g/100g`,
    });
  }
  if (fiber >= 6) {
    macro_roles.push({
      label: "高纤",
      tone: "good",
      detail: `膳食纤维 ${round1(fiber)}g/100g`,
    });
  }
  // 高碳：碳水供能比 ≥60% 且绝对值 ≥30g
  if (totalMacroCal > 0 && (carb * 4) / totalMacroCal >= 0.6 && carb >= 30) {
    macro_roles.push({
      label: "高碳水",
      tone: "neutral",
      detail: `碳水 ${round1(carb)}g/100g`,
    });
  }
  // 高脂：脂肪供能比 ≥45% 且绝对值 ≥15g
  if (totalMacroCal > 0 && (fat * 9) / totalMacroCal >= 0.45 && fat >= 15) {
    macro_roles.push({
      label: "高脂",
      tone: "neutral",
      detail: `脂肪 ${round1(fat)}g/100g`,
    });
  }

  // 3. 微量亮点 top3：占 DRI ≥30% 的微量营养素，降序取前 3
  const microHighlights: { key: NutrientKey; pct: number; value: number }[] = [];
  for (const key of MICRO_NUTRIENTS) {
    const v = nutrientValue(food, key);
    if (v == null) continue;
    const pct = pctOfDRI(food, key, dri);
    if (pct != null && pct >= 30) {
      microHighlights.push({ key, pct, value: v });
    } else if (pct == null && v > 0) {
      // 无 DRI（如未填画像）时，退化为按绝对值是否"显著"判断
      // 用一个保守阈值：矿物质 ≥ 日需中位数的 20%（按成人 DRI 中位数近似）
      const fallbackDri = FALLBACK_MICRO_DRI[key];
      if (fallbackDri && v / fallbackDri >= 0.3) {
        microHighlights.push({ key, pct: (v / fallbackDri) * 100, value: v });
      }
    }
  }
  microHighlights.sort((a, b) => b.pct - a.pct);
  const micro_highlights: FoodTag[] = microHighlights.slice(0, 3).map((m) => ({
    label: `富含${NUTRIENT_LABELS[m.key]}`,
    tone: "good" as TagTone,
    detail: `${round1(m.value)}${NUTRIENT_UNITS[m.key]}/100g · 满足日需 ${Math.round(m.pct)}%`,
  }));

  // 4. 警戒项
  const warnings: FoodTag[] = [];
  const sodium = nutrientValue(food, "sodium_mg");
  if (sodium != null && sodium >= 600) {
    warnings.push({
      label: "钠偏高",
      tone: "warn",
      detail: `${Math.round(sodium)}mg/100g · 注意控盐`,
    });
  }
  if (fiber < 3 && energy >= 100) {
    warnings.push({
      label: "纤维偏低",
      tone: "warn",
      detail: `仅 ${round1(fiber)}g/100g · 建议搭配蔬果`,
    });
  }

  const all_tags: FoodTag[] = [
    { label: energyLabel, tone: "neutral", detail: energyDetail },
    ...macro_roles,
    ...micro_highlights,
    ...warnings,
  ];

  return {
    energy_density: { level, label: energyLabel, detail: energyDetail },
    macro_roles,
    micro_highlights,
    warnings,
    all_tags,
  };
}

/** 无画像时的退化 DRI（取成人 18-49 男性中位数，仅用于微量亮点兜底） */
const FALLBACK_MICRO_DRI: Partial<Record<NutrientKey, number>> = {
  sodium_mg: 1500,
  potassium_mg: 2000,
  calcium_mg: 800,
  magnesium_mg: 330,
  iron_mg: 12,
  zinc_mg: 12.5,
  selenium_ug: 60,
  vit_a_ugre: 800,
  vit_b1_mg: 1.4,
  vit_b2_mg: 1.4,
  vit_b6_mg: 1.4,
  vit_b12_ug: 2.4,
  vit_c_mg: 100,
  vit_d_ug: 10,
  vit_e_mg: 14,
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
