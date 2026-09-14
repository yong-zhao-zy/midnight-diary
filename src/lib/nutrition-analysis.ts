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
