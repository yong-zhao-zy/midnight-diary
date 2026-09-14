import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchDietLogsByRange } from "@/lib/diet-log-service";
import { fetchBodyMetricsByRange } from "@/lib/body-metric-service";
import { fetchHealthProfile } from "@/lib/health-profile-service";
import { analyzePeriod } from "@/lib/nutrition-analysis";
import { NUTRIENT_LABELS, type NutrientKey } from "@/config/dri-config";
import { todayShanghaiStr, minusOneDay } from "@/lib/date-utils";

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
  lines.push(`分析周期：${analysis.start_date} 至 ${analysis.end_date}（${analysis.period === "week" ? "近一周" : "近一月"}）`);
  lines.push("");
  lines.push("【平均每日营养素摄入与达成率】");
  for (const a of analysis.assessments) {
    const label = NUTRIENT_LABELS[a.key];
    const ratingText = { sufficient: "充足", borderline: "临界", deficient: "不足", excessive: "过量" }[a.rating];
    lines.push(`- ${label}：摄入 ${round1(a.intake)}，目标 ${round1(a.dri)}，达成率 ${Math.round(a.achievement_rate)}%，评级 ${ratingText}`);
  }
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
  return lines.join("\n");
}

async function interpretWithAI(summary: string): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return "（AI 解读暂不可用，请在服务端配置 DEEPSEEK_API_KEY）";
  }

  const systemPrompt = `你是一位专业的营养师和健康顾问。用户的数据中，各营养素的评级和达成率已由系统计算完成，你只需解读数据并给出可操作建议，不要重新计算数值。

请用中文输出，包含以下部分（用标题标注）：
【总体评价】一两句话总结整体饮食与身体状况。
【重点关注项】指出达标率偏低或偏高的营养素（最多 3 项），说明影响。
【体重趋势解读】结合体重变化给出简短判断。
【下周建议】给出 3-4 条具体可执行的建议（食物选择/分量调整等）。

保持温和、专业、简洁，总字数 400 字以内。不要使用 markdown 代码块。`;

  const messages = [
    { role: "system", content: systemPrompt },
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
        max_tokens: 800,
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
