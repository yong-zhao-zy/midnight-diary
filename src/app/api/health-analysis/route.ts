import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchDietLogsByRange } from "@/lib/diet-log-service";
import { fetchBodyMetricsByRange } from "@/lib/body-metric-service";
import { fetchHealthProfile } from "@/lib/health-profile-service";
import { analyzePeriod, TARGET_MICRO_LABELS, OMEGA3_DRI_G, type TargetMicroKey } from "@/lib/nutrition-analysis";
import { NUTRIENT_LABELS, type NutrientKey } from "@/config/dri-config";
import { todayShanghaiStr, minusOneDay } from "@/lib/date-utils";
import { SJOGREN_NUTRITION_SYSTEM_PROMPT } from "@/lib/health-prompts";

interface RequestBody {
  startDate?: string;
  endDate?: string;
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

    const [dietLogs, bodyMetrics, profile] = await Promise.all([
      fetchDietLogsByRange(user.id, startDate, endDate, supabase),
      fetchBodyMetricsByRange(user.id, startDate, endDate, supabase),
      fetchHealthProfile(supabase),
    ]);

    const analysis = analyzePeriod(dietLogs, bodyMetrics, profile, startDate, endDate);

    // Build a structured, AI-friendly summary (ratings + rates already computed)
    const summary = buildSummaryForAI(analysis);
    const aiAdvice = await interpretWithAI(summary);

    return NextResponse.json({ success: true, analysis, aiAdvice });
  } catch (error) {
    console.error("[api/health-analysis POST] error:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}

function buildSummaryForAI(analysis: ReturnType<typeof analyzePeriod>): string {
  const lines: string[] = [];
  lines.push(`分析周期：${analysis.start_date} 至 ${analysis.end_date}（${analysis.period === "week" ? "近一周" : "近一月"}），以下为周期内平均每日数据。`);
  lines.push("");
  lines.push("【平均每日营养素摄入与达成率（系统已计算，你只需解读）】");
  for (const a of analysis.assessments) {
    const label = NUTRIENT_LABELS[a.key];
    const ratingText = { sufficient: "充足", borderline: "临界", deficient: "不足", excessive: "过量" }[a.rating];
    lines.push(`- ${label}：摄入 ${round1(a.intake)}，目标 ${round1(a.dri)}，达成率 ${Math.round(a.achievement_rate)}%，评级 ${ratingText}`);
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
      lines.push(`- ${label}：摄入 ${round1(a.intake)}，目标 ${round1(a.dri)}，达成率 ${Math.round(a.achievement_rate)}%，评级 ${ratingTextFull[a.rating] ?? a.rating}`);
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
