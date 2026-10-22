import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchDietLogsByRange } from "@/lib/diet-log-service";
import { fetchBodyMetricsByRange, fetchRecentBodyMetrics } from "@/lib/body-metric-service";
import { fetchHealthProfile } from "@/lib/health-profile-service";
import { fetchFoodsByIds } from "@/lib/food-service";
import type { FoodRow } from "@/lib/food-service";
import { analyzePeriod, TARGET_MICRO_LABELS, OMEGA3_DRI_G, type TargetMicroKey } from "@/lib/nutrition-analysis";
import { NUTRIENT_LABELS } from "@/config/dri-config";
import { todayShanghaiStr, minusOneDay } from "@/lib/date-utils";
import { SJOGREN_NUTRITION_SYSTEM_PROMPT } from "@/lib/health-prompts";
import { fetchStoredReport, isUsableReport, periodKey, saveStoredReport } from "@/lib/analysis-report-service";

interface RequestBody {
  startDate?: string;
  endDate?: string;
  /** true = 忽略已有报告，强制重新生成 */
  force?: boolean;
}

/**
 * GET /api/health-analysis?startDate=&endDate=
 * 只读缓存：该周期已生成过报告就直接回放（不调 LLM、不重算）。
 */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const endDate = params.get("endDate")?.trim() || todayShanghaiStr();
    let startDate = params.get("startDate")?.trim();
    if (!startDate) {
      startDate = endDate;
      for (let i = 0; i < 6; i++) startDate = minusOneDay(startDate);
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const cached = await fetchStoredReport<ReturnType<typeof analyzePeriod>>(
      supabase,
      "period",
      periodKey(startDate, endDate)
    );
    if (!cached) {
      return NextResponse.json({ success: true, found: false });
    }

    return NextResponse.json({
      success: true,
      found: true,
      startDate,
      endDate,
      analysis: cached.payload,
      aiAdvice: cached.report,
      generatedAt: cached.generatedAt,
    });
  } catch (error) {
    console.error("[api/health-analysis GET] error:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as RequestBody;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    // Default to last 7 days
    const endDate = body.endDate?.trim() || todayShanghaiStr();
    let startDate = body.startDate?.trim();
    if (!startDate) {
      startDate = endDate;
      for (let i = 0; i < 6; i++) startDate = minusOneDay(startDate);
    }

    // 非强制生成：该周期已有报告直接回放
    if (!body.force) {
      const cached = await fetchStoredReport<ReturnType<typeof analyzePeriod>>(
        supabase,
        "period",
        periodKey(startDate, endDate)
      );
      if (cached?.payload) {
        return NextResponse.json({
          success: true,
          cached: true,
          startDate,
          endDate,
          analysis: cached.payload,
          aiAdvice: cached.report,
          generatedAt: cached.generatedAt,
        });
      }
    }

    const [dietLogs, bodyMetrics, profile, recentMetrics] = await Promise.all([
      fetchDietLogsByRange(user.id, startDate, endDate, supabase),
      fetchBodyMetricsByRange(user.id, startDate, endDate, supabase),
      fetchHealthProfile(supabase),
      // 周期内可能没记体重：取全局最近一条做 DRI 兜底
      fetchRecentBodyMetrics(user.id, 1, supabase),
    ]);

    // 周期内没有任何饮食记录：直接报错，避免让 AI 对着空数据编一份报告再被封存
    if (dietLogs.length === 0) {
      return NextResponse.json(
        { error: "该周期暂无饮食记录，请先记录饮食后再生成报告" },
        { status: 400 }
      );
    }

    // 微量营养素按 food_id × 克重实时计算，需要命中食物库
    const foodIds = Array.from(
      new Set(dietLogs.map((l) => l.food_id).filter((id): id is string => !!id))
    );
    const foods = await fetchFoodsByIds(foodIds, supabase);
    const foodsMap = new Map<string, FoodRow>(foods.map((f) => [f.id, f]));

    const refWeight =
      recentMetrics.find((m) => m.weight_kg != null)?.weight_kg ??
      profile.target_weight_kg ??
      null;

    const analysis = analyzePeriod(dietLogs, bodyMetrics, profile, startDate, endDate, {
      refWeight,
      foodsMap,
    });

    // Build a structured, AI-friendly summary (ratings + rates already computed)
    const summary = buildSummaryForAI(analysis, dietLogs, foodsMap);
    const aiAdvice = await interpretWithAI(summary);

    // 封存快照：换日期范围再换回来直接回放
    const generatedAt = isUsableReport(aiAdvice)
      ? await saveStoredReport(supabase, {
          userId: user.id,
          scope: "period",
          key: periodKey(startDate, endDate),
          report: aiAdvice,
          payload: analysis,
        })
      : null;

    return NextResponse.json({ success: true, startDate, endDate, analysis, aiAdvice, generatedAt });
  } catch (error) {
    console.error("[api/health-analysis POST] error:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}

function buildSummaryForAI(
  analysis: ReturnType<typeof analyzePeriod>,
  dietLogs: Awaited<ReturnType<typeof fetchDietLogsByRange>>,
  foodsMap: Map<string, FoodRow>
): string {
  const lines: string[] = [];
  lines.push(`分析周期：${analysis.start_date} 至 ${analysis.end_date}（${analysis.period === "week" ? "近一周" : "近一月"}），以下为周期内平均每日数据。`);
  lines.push("");

  // 食物清单：让 AI 知道用户真的记录了什么，避免编造「未记录」
  const foodStat = new Map<string, { name: string; count: number; qty: number }>();
  let recipeCount = 0;
  for (const log of dietLogs) {
    if (log.recipe_id) {
      recipeCount += 1;
      continue;
    }
    if (!log.food_id) continue;
    const name = foodsMap.get(log.food_id)?.name ?? "未知食物";
    const stat = foodStat.get(log.food_id) ?? { name, count: 0, qty: 0 };
    stat.count += 1;
    stat.qty += Number(log.quantity_g) || 0;
    foodStat.set(log.food_id, stat);
  }
  const recipeLines = dietLogs.filter((l) => l.recipe_id).length;
  lines.push(`【周期内饮食记录】共 ${dietLogs.length} 条（食物 ${dietLogs.length - recipeLines} 条、自建菜谱 ${recipeCount} 条），用户确实记录了饮食，不要声称「未记录食物」。`);
  const sortedFoods = [...foodStat.values()].sort((a, b) => b.count - a.count);
  if (sortedFoods.length > 0) {
    lines.push("【食物清单】（按出现次数降序，最多 15 项，格式：名称 ×次数）");
    for (const f of sortedFoods.slice(0, 15)) {
      lines.push(`- ${f.name} ×${f.count}`);
    }
  } else if (recipeCount > 0) {
    lines.push("【食物清单】本周期以自建菜谱记录为主（菜谱暂无食材级微量数据）。");
  }
  lines.push("");

  lines.push("【平均每日营养素摄入与达成率（系统已计算，你只需解读）】");
  for (const a of analysis.assessments) {
    const label = NUTRIENT_LABELS[a.key];
    const ratingText = { sufficient: "充足", borderline: "临界", deficient: "不足", excessive: "过量", no_data: "无数据" }[a.rating];
    if (!a.has_data) {
      lines.push(`- ${label}：无有效摄入数据（食物库未收录该成分），目标 ${round1(a.dri)}，无法评估`);
    } else {
      lines.push(`- ${label}：摄入 ${round1(a.intake)}，目标 ${round1(a.dri)}，达成率 ${Math.round(a.achievement_rate)}%，评级 ${ratingText}`);
    }
  }
  lines.push("");
  lines.push("【8 大关键靶向微量营养素达成（干燥症抗炎视角，系统已计算，你只需解读）】");
  const ratingTextFull: Record<string, string> = { sufficient: "🟢 充足", borderline: "🟡 需留意", deficient: "🔴 明显缺口", excessive: "🔴 过量" };
  const microKeyToTarget: Record<string, TargetMicroKey> = {
    vit_a_ugre: "vit_a_ugre",
    vit_d_ug: "vit_d_ug",
    selenium_ug: "selenium_ug",
    fiber_g: "fiber_g",
    potassium_mg: "potassium_mg",
    vit_b12_ug: "vit_b12_ug",
    iron_mg: "iron_mg",
  };
  for (const [sourceKey, targetKey] of Object.entries(microKeyToTarget)) {
    const a = analysis.assessments.find((x) => x.key === sourceKey);
    if (a) {
      const label = TARGET_MICRO_LABELS[targetKey];
      const ratingText = a.rating === "no_data" ? "⚪ 无数据" : (ratingTextFull[a.rating] ?? a.rating);
      if (!a.has_data) {
        lines.push(`- ${label}：无有效摄入数据（食物库未收录该成分），目标 ${round1(a.dri)}，无法评估`);
      } else {
        lines.push(`- ${label}：摄入 ${round1(a.intake)}，目标 ${round1(a.dri)}，达成率 ${Math.round(a.achievement_rate)}%，评级 ${ratingText}`);
      }
    }
  }
  lines.push(`- ${TARGET_MICRO_LABELS.omega3_g}：无周期数据库值，请根据用户饮食结构推算并标注，参考 DRI 为 ${OMEGA3_DRI_G} g/天。`);
  lines.push("");
  lines.push(`【热量目标】${analysis.calorie_trend[0]?.target ?? 0} kcal/天`);
  const avgKcal = round1(analysis.avg_daily_nutrients.energy_kcal);
  lines.push(`【平均每日热量】${avgKcal} kcal`);
  lines.push("");
  if (analysis.body_metrics_change.weight_change != null) {
    lines.push(`【体重变化】${round1(analysis.body_metrics_change.weight_change)} kg`);
  }
  if (analysis.body_metrics_change.waist_change != null) {
    lines.push(`【腰围变化】${round1(analysis.body_metrics_change.waist_change)} cm`);
  }
  const weights = analysis.body_weight_trend.filter((w) => w.weight != null);
  if (weights.length > 0) {
    lines.push(`【体重记录】${weights.length} 天有记录，最新 ${weights[weights.length - 1].weight} kg`);
  } else {
    lines.push("【体重记录】周期内无体重记录");
  }
  lines.push("");
  lines.push("【系统约束】");
  lines.push("1. 上述评级与达成率已由系统计算完成，你只需解读数据并给出可操作建议，不要重新计算数值。");
  lines.push("2. Omega-3 无周期数据库值，请根据用户饮食结构推算并明确标注推算依据。");
  lines.push("3. 标注「无数据」的营养素是食物库未收录该成分字段所致，不是用户没有记录；不要建议用户「补记录」，也不要据此断言摄入为零，可以说「无法从现有数据评估」。");
  return lines.join("\n");
}

async function interpretWithAI(summary: string): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return "（AI 解读暂不可用，请在服务端配置 DEEPSEEK_API_KEY）";
  }

  const messages = [
    { role: "system", content: SJOGREN_NUTRITION_SYSTEM_PROMPT },
    { role: "user", content: summary },
  ];

  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages,
        temperature: 0.5,
        max_tokens: 2000,
      }),
    });

    if (!res.ok) {
      console.error("DeepSeek API error:", await res.text());
      return "（AI 解读暂时不可用，请稍后重试）";
    }

    const json = await res.json();
    const text = json.choices?.[0]?.message?.content ?? "";
    return text.trim() || "（AI 未返回内容）";
  } catch (err) {
    console.error("Health analysis AI error:", err);
    return "（AI 解读失败，请稍后重试）";
  }
}

function round1(n: number): number {
  return Math.round((Number(n) || 0) * 10) / 10;
}
