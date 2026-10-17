/**
 * 营养素合理性分析 — 纯计算函数（无副作用，无 Supabase 调用）
 *
 * 根据饮食记录 + 身体数据 + 用户画像，计算各营养素的达成率与评级。
 * JS 算出结论后交由 AI 做自然语言解读，AI 不重新计算数值。
 */

import {
  type HealthProfile,
  type NutrientKey,
  type DRIEntry,
  NUTRIENT_KEYS,
  calcBMR,
  calcTDEE,
  getPersonalizedDRI,
} from "@/config/dri-config";
import type { DietLogRow } from "@/lib/diet-log-service";
import type { BodyMetricRow } from "@/lib/body-metric-service";
import type { FoodRow } from "@/lib/food-service";

export type NutrientRating = "sufficient" | "borderline" | "deficient" | "excessive";

export interface NutrientAssessment {
  key: NutrientKey;
  intake: number;
  dri: number;
  achievement_rate: number;
  rating: NutrientRating;
}

export interface DailyNutrientSummary {
  date: string;
  nutrients: Record<NutrientKey, number>;
}

export interface PeriodAnalysis {
  period: "week" | "month";
  start_date: string;
  end_date: string;
  daily_summaries: DailyNutrientSummary[];
  avg_daily_nutrients: Record<NutrientKey, number>;
  assessments: NutrientAssessment[];
  calorie_trend: Array<{ date: string; kcal: number; target: number }>;
  body_weight_trend: Array<{ date: string; weight: number | null }>;
  body_metrics_change: {
    weight_change: number | null;
    waist_change: number | null;
  };
}

/** 钠反向评级（过量预警），其他营养素正向评级 */
export function rateNutrient(
  key: NutrientKey,
  intake: number,
  dri: number
): NutrientRating {
  if (dri <= 0) return "deficient";
  const rate = (intake / dri) * 100;

  if (key === "sodium_mg") {
    if (rate > 120) return "excessive";
    if (rate >= 50) return "sufficient";
    return "deficient";
  }

  if (rate >= 80) return "sufficient";
  if (rate >= 50) return "borderline";
  return "deficient";
}

/** 计算 BMR / TDEE / 目标热量 */
export function calculateEnergyNeeds(
  profile: HealthProfile,
  currentWeightKg: number
): { bmr: number; tdee: number; target: number } {
  if (!profile.birth_date || !profile.gender || !profile.height_cm) {
    return { bmr: 0, tdee: 0, target: profile.calorie_goal ?? 2000 };
  }

  const bmr = calcBMR(
    profile.gender,
    currentWeightKg,
    profile.height_cm,
    new Date().getFullYear() - new Date(profile.birth_date).getFullYear()
  );
  const tdee = calcTDEE(bmr, profile.activity_level ?? "moderate");
  return { bmr, tdee, target: profile.calorie_goal ?? tdee };
}

/** 累加某天 diet_logs 的 5 个宏量营养素，微量初始化为 0 */
function sumNutrientsForDay(logs: DietLogRow[]): Record<NutrientKey, number> {
  const result = {} as Record<NutrientKey, number>;
  for (const key of NUTRIENT_KEYS) {
    result[key] = 0;
  }

  for (const log of logs) {
    result.energy_kcal += Number(log.energy_kcal) || 0;
    result.protein_g += Number(log.protein_g) || 0;
    result.fat_g += Number(log.fat_g) || 0;
    result.carb_g += Number(log.carb_g) || 0;
    result.fiber_g += Number(log.fiber_g) || 0;
  }

  return result;
}

/** 找最近一条有 weight_kg 的记录 */
function getLatestWeight(bodyMetrics: BodyMetricRow[]): number | null {
  for (const m of bodyMetrics) {
    if (m.weight_kg != null) return m.weight_kg;
  }
  return null;
}

/** 生成日期范围数组（含首尾） */
function eachDateStr(startDate: string, endDate: string): string[] {
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  const dates: string[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

/** 主分析入口 */
export function analyzePeriod(
  dietLogs: DietLogRow[],
  bodyMetrics: BodyMetricRow[],
  profile: HealthProfile,
  startDate: string,
  endDate: string
): PeriodAnalysis {
  const dates = eachDateStr(startDate, endDate);
  const period: "week" | "month" = dates.length <= 8 ? "week" : "month";

  // bodyMetrics 按 log_date 建映射（取最近一条）
  const bodyByDate = new Map<string, BodyMetricRow>();
  for (const m of bodyMetrics) {
    bodyByDate.set(m.log_date, m);
  }

  // dietLogs 按 log_date 建映射
  const logsByDate = new Map<string, DietLogRow[]>();
  for (const log of dietLogs) {
    const arr = logsByDate.get(log.log_date) ?? [];
    arr.push(log);
    logsByDate.set(log.log_date, arr);
  }

  // 1-3. 每日汇总
  const daily_summaries: DailyNutrientSummary[] = dates.map((date) => ({
    date,
    nutrients: sumNutrientsForDay(logsByDate.get(date) ?? []),
  }));

  // 4. 平均每日营养素
  const avg_daily_nutrients = {} as Record<NutrientKey, number>;
  for (const key of NUTRIENT_KEYS) {
    const total = daily_summaries.reduce((sum, d) => sum + d.nutrients[key], 0);
    avg_daily_nutrients[key] = dates.length > 0 ? total / dates.length : 0;
  }

  // 5. 最新体重
  const latestWeight = getLatestWeight(bodyMetrics);

  // 6. 个性化 DRI
  const dri: DRIEntry | null = latestWeight != null
    ? getPersonalizedDRI(profile, latestWeight)
    : null;

  // 7. 各营养素评估
  const assessments: NutrientAssessment[] = NUTRIENT_KEYS.map((key) => {
    const intake = avg_daily_nutrients[key];
    const driValue = dri ? (dri as unknown as Record<NutrientKey, number>)[key] : 0;
    const achievement_rate = driValue > 0 ? (intake / driValue) * 100 : 0;
    return {
      key,
      intake,
      dri: driValue,
      achievement_rate,
      rating: rateNutrient(key, intake, driValue),
    };
  });

  // 8. 热量趋势
  const { target } = calculateEnergyNeeds(profile, latestWeight ?? 65);
  const calorie_trend = daily_summaries.map((d) => ({
    date: d.date,
    kcal: Math.round(d.nutrients.energy_kcal),
    target,
  }));

  // 9. 体重趋势
  const body_weight_trend = dates.map((date) => {
    const m = bodyByDate.get(date);
    return { date, weight: m?.weight_kg ?? null };
  });

  // 10. 首尾变化
  const firstMetric = bodyMetrics[bodyMetrics.length - 1];
  const lastMetric = bodyMetrics[0];
  const weight_change =
    firstMetric?.weight_kg != null && lastMetric?.weight_kg != null
      ? lastMetric.weight_kg - firstMetric.weight_kg
      : null;
  const waist_change =
    firstMetric?.waist_cm != null && lastMetric?.waist_cm != null
      ? lastMetric.waist_cm - firstMetric.waist_cm
      : null;

  return {
    period,
    start_date: startDate,
    end_date: endDate,
    daily_summaries,
    avg_daily_nutrients,
    assessments,
    calorie_trend,
    body_weight_trend,
    body_metrics_change: { weight_change, waist_change },
  };
}

// ─── 单日分析（今日饮食分析用）──────────────────────────────

/**
 * 8 大关键靶向微量营养素 key。
 * 前 7 项对应 foods 表真实字段；omega3_g 为虚拟 key（foods 表无此字段，intake=null 交 AI 推算）。
 */
export const TARGET_MICRO_KEYS = [
  "vit_a_ugre",
  "omega3_g",
  "vit_d_ug",
  "selenium_ug",
  "fiber_g",
  "potassium_mg",
  "vit_b12_ug",
  "iron_mg",
] as const;

export type TargetMicroKey = (typeof TARGET_MICRO_KEYS)[number];

/** Omega-3 参考 DRI（g/天），AI 推算时的基准 */
export const OMEGA3_DRI_G = 1.6;

/** 虚拟营养素 label 扩展（omega3_g 不在 NUTRIENT_LABELS 里） */
export const TARGET_MICRO_LABELS: Record<TargetMicroKey, string> = {
  vit_a_ugre: "维生素 A",
  omega3_g: "Omega-3",
  vit_d_ug: "维生素 D",
  selenium_ug: "硒 (Se)",
  fiber_g: "膳食纤维",
  potassium_mg: "钾 (K)",
  vit_b12_ug: "维生素 B12",
  iron_mg: "铁 (Fe)",
};

export interface DayMicroAssessment {
  key: TargetMicroKey;
  intake: number | null; // null = 无数据（如 Omega-3 / recipe 类型），交 AI 推算
  dri: number;
  achievement_rate: number | null; // null = 无法计算
  rating: NutrientRating | "unknown"; // unknown = 无数据
  sources: string; // 今日主要来源食物名
}

export interface DayMacroSummary {
  energy_kcal: number;
  protein_g: number;
  fat_g: number;
  carb_g: number;
  fiber_g: number;
}

export interface DayFoodEntry {
  name: string;
  meal_type: string;
  quantity_g: number | null;
  servings: number | null;
  is_recipe: boolean;
}

export interface DayAnalysis {
  date: string;
  macro: DayMacroSummary;
  micro_assessments: DayMicroAssessment[];
  foods: DayFoodEntry[];
}

/**
 * 单日饮食分析。
 * - 5 宏量取 diet_logs 冻结值
 * - 7 微量从 foodsMap 按 food_id×quantity_g/100 实时算（recipe 类型无食材明细，微量置 null）
 * - Omega-3 无 DB 字段，intake=null 交 AI 推算
 */
export function analyzeDay(
  dietLogs: DietLogRow[],
  foodsMap: Map<string, FoodRow>,
  profile: HealthProfile,
  date: string
): DayAnalysis {
  // 宏量累加（冻结值）
  const macro: DayMacroSummary = {
    energy_kcal: 0,
    protein_g: 0,
    fat_g: 0,
    carb_g: 0,
    fiber_g: 0,
  };

  // 微量累加器：只累加 food 类型且 foodsMap 命中的；recipe 类型记 null 标记
  const microAcc: Record<Exclude<TargetMicroKey, "omega3_g">, { sum: number; sources: string[]; hasRecipe: boolean }> = {
    vit_a_ugre: { sum: 0, sources: [], hasRecipe: false },
    vit_d_ug: { sum: 0, sources: [], hasRecipe: false },
    selenium_ug: { sum: 0, sources: [], hasRecipe: false },
    fiber_g: { sum: 0, sources: [], hasRecipe: false },
    potassium_mg: { sum: 0, sources: [], hasRecipe: false },
    vit_b12_ug: { sum: 0, sources: [], hasRecipe: false },
    iron_mg: { sum: 0, sources: [], hasRecipe: false },
  };

  const foods: DayFoodEntry[] = [];

  for (const log of dietLogs) {
    macro.energy_kcal += Number(log.energy_kcal) || 0;
    macro.protein_g += Number(log.protein_g) || 0;
    macro.fat_g += Number(log.fat_g) || 0;
    macro.carb_g += Number(log.carb_g) || 0;
    macro.fiber_g += Number(log.fiber_g) || 0;

    if (log.food_id) {
      const food = foodsMap.get(log.food_id);
      const qtyG = Number(log.quantity_g) || 0;
      const ratio = qtyG / 100;

      foods.push({
        name: food?.name ?? "未知食物",
        meal_type: log.meal_type,
        quantity_g: log.quantity_g,
        servings: log.servings,
        is_recipe: false,
      });

      if (food) {
        // 累加 7 项微量（fiber 也从 food 算，覆盖冻结 fiber_g）
        (Object.keys(microAcc) as Array<Exclude<TargetMicroKey, "omega3_g">>).forEach((key) => {
          const foodVal = food[key] as number | null;
          if (foodVal != null) {
            microAcc[key].sum += foodVal * ratio;
            if (foodVal > 0) microAcc[key].sources.push(food.name);
          }
        });
      }
    } else if (log.recipe_id) {
      foods.push({
        name: "菜谱记录",
        meal_type: log.meal_type,
        quantity_g: null,
        servings: log.servings,
        is_recipe: true,
      });
      // recipe 类型无食材明细，微量置 null 标记
      (Object.keys(microAcc) as Array<Exclude<TargetMicroKey, "omega3_g">>).forEach((key) => {
        microAcc[key].hasRecipe = true;
      });
    }
  }

  // DRI
  const latestWeight = profile.target_weight_kg ?? 65;
  const dri = getPersonalizedDRI(profile, latestWeight);

  // 构造 8 项评估
  const micro_assessments: DayMicroAssessment[] = TARGET_MICRO_KEYS.map((key) => {
    if (key === "omega3_g") {
      return {
        key,
        intake: null,
        dri: OMEGA3_DRI_G,
        achievement_rate: null,
        rating: "unknown" as const,
        sources: "无数据库值，请根据食材推算",
      };
    }
    const acc = microAcc[key];
    const driValue = dri ? (dri as unknown as Record<string, number>)[key] : 0;
    const hasData = !acc.hasRecipe || acc.sum > 0;
    const intake = hasData ? acc.sum : null;
    const achievement_rate = driValue > 0 && intake != null ? (intake / driValue) * 100 : null;
    const rating: NutrientRating | "unknown" =
      intake == null ? "unknown" : rateNutrient(key as NutrientKey, intake, driValue);
    const sourcesText = acc.sources.length > 0 ? dedupe(acc.sources).slice(0, 3).join("、") : (acc.hasRecipe ? "含菜谱记录（明细待补）" : "无明显来源");
    return { key, intake, dri: driValue, achievement_rate, rating, sources: sourcesText };
  });

  return { date, macro, micro_assessments, foods };
}

function dedupe(arr: string[]): string[] {
  return [...new Set(arr)];
}
