import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchDietLogsByDate } from "@/lib/diet-log-service";
import { fetchRecentBodyMetrics } from "@/lib/body-metric-service";
import { fetchHealthProfile } from "@/lib/health-profile-service";
import { analyzeDay, calculateEnergyNeeds, TARGET_MICRO_LABELS, OMEGA3_DRI_G, type DayAnalysis } from "@/lib/nutrition-analysis";
import { todayShanghaiStr } from "@/lib/date-utils";
import type { FoodRow } from "@/lib/food-service";
import { FOOD_SELECT } from "@/lib/food-service";
import { SJOGREN_NUTRITION_SYSTEM_PROMPT } from "@/lib/health-prompts";
import { dayKey, fetchStoredReport, isUsableReport, saveStoredReport } from "@/lib/analysis-report-service";
const RATING_TEXT: Record<string, string> = {
  sufficient: "🟢 充足",
  borderline: "🟡 需留意",
  deficient: "🔴 明显缺口",
  excessive: "🔴 过量",
  unknown: "⚪ 数据待推算",
};

interface RequestBody {
  date?: string;
  /** true = 忽略已有报告，强制重新生成 */
  force?: boolean;
}

/**
 * GET /api/diet-analysis?date=YYYY-MM-DD
 * 只读缓存：该日已生成过报告就直接回放（不调 LLM、不重算）。
 * 没有则返回 found:false，由前端决定是否触发生成。
 */
export async function GET(request: Request) {
  try {
    const date = new URL(request.url).searchParams.get("date")?.trim() || todayShanghaiStr();

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const cached = await fetchStoredReport<DayAnalysis>(supabase, "day", dayKey(date));
    if (!cached) {
      return NextResponse.json({ success: true, found: false });
    }

    return NextResponse.json({
      success: true,
      found: true,
      date,
      analysis: cached.payload,
      aiReport: cached.report,
      generatedAt: cached.generatedAt,
    });
  } catch (error) {
    console.error("[api/diet-analysis GET] error:", error);
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

    const date = body.date?.trim() || todayShanghaiStr();

    // 非强制生成：已有报告直接回放，省一次 LLM 调用
    if (!body.force) {
      const cached = await fetchStoredReport<DayAnalysis>(supabase, "day", dayKey(date));
      if (cached?.payload) {
        return NextResponse.json({
          success: true,
          cached: true,
          date,
          analysis: cached.payload,
          aiReport: cached.report,
          generatedAt: cached.generatedAt,
        });
      }
    }

    const [dietLogs, profile, recentMetrics] = await Promise.all([
      fetchDietLogsByDate(user.id, date, supabase),
      fetchHealthProfile(supabase),
      fetchRecentBodyMetrics(user.id, 1, supabase),
    ]);

    if (dietLogs.length === 0) {
      return NextResponse.json({ error: "今日暂无饮食记录，请先添加食物" }, { status: 400 });
    }

    // DRI 参考体重兜底（与 health-analysis 同口径）：最近体重 → 画像目标体重
    const refWeight =
      recentMetrics.find((m) => m.weight_kg != null)?.weight_kg ??
      profile.target_weight_kg ??
      null;

    // 批量取 foods（预 JOIN）
    const foodIds = Array.from(new Set(dietLogs.map((l) => l.food_id).filter((id): id is string => !!id)));
    const foodsMap = new Map<string, FoodRow>();
    if (foodIds.length > 0) {
      const { data: foodsData, error: foodsErr } = await supabase
        .from("foods")
        .select(FOOD_SELECT)
        .in("id", foodIds)
        .eq("is_deleted", false);
      if (!foodsErr && foodsData) {
        for (const f of foodsData as FoodRow[]) {
          foodsMap.set(f.id, f);
        }
      }
    }

    const analysis = analyzeDay(dietLogs as unknown as Parameters<typeof analyzeDay>[0], foodsMap, profile, date, {
      refWeight,
    });

    // 个人热量目标：健康画像 calorie_goal 优先，缺画像信息时按 BMR×活动水平推算，再退默认 2000
    // （与 analyzeDay 同口径用 target_weight_kg ?? 65 估重；体重仅影响 TDEE 推算，不影响用户设定值）
    const energyNeeds = calculateEnergyNeeds(profile, profile.target_weight_kg ?? 65);
    const goalSource = profile.calorie_goal
      ? "用户在健康画像中设定"
      : energyNeeds.tdee > 0
        ? "按健康画像 BMR×活动水平推算"
        : "默认值（健康画像未完善，建议到【我的-健康画像】补全）";

    const summary = buildSummaryForAI(analysis, energyNeeds.target, goalSource);
    const aiReport = await interpretWithAI(summary);

    // 封存快照：切到别的日期再切回来直接回放
    const generatedAt = isUsableReport(aiReport)
      ? await saveStoredReport(supabase, {
          userId: user.id,
          scope: "day",
          key: dayKey(date),
          report: aiReport,
          payload: analysis,
        })
      : null;

    return NextResponse.json({ success: true, date, analysis, aiReport, generatedAt });
  } catch (error) {
    console.error("[api/diet-analysis POST] error:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}

function buildSummaryForAI(analysis: DayAnalysis, calorieTarget: number, goalSource: string): string {
  const lines: string[] = [];
  lines.push(`分析日期：${analysis.date}`);
  lines.push("");
  lines.push("【今日宏量营养素摄入（冻结值）】");
  lines.push(`- 热量：${round1(analysis.macro.energy_kcal)} kcal`);
  lines.push(`- 蛋白质：${round1(analysis.macro.protein_g)} g`);
  lines.push(`- 脂肪：${round1(analysis.macro.fat_g)} g`);
  lines.push(`- 碳水：${round1(analysis.macro.carb_g)} g`);
  lines.push(`- 膳食纤维：${round1(analysis.macro.fiber_g)} g`);
  lines.push("");
  lines.push("【个人热量目标（来自健康画像，评估能量时以此为准）】");
  lines.push(`- 每日热量目标：${Math.round(calorieTarget)} kcal（${goalSource}）`);
  const gap = round1(analysis.macro.energy_kcal - calorieTarget);
  const pct = calorieTarget > 0 ? Math.round((analysis.macro.energy_kcal / calorieTarget) * 100) : 0;
  lines.push(`- 今日摄入 ${round1(analysis.macro.energy_kcal)} kcal，为目标的 ${pct}%（${gap >= 0 ? "盈余" : "缺口"} ${Math.abs(gap)} kcal）`);
  lines.push("");
  lines.push("【8 大关键营养素达成情况（系统已计算评级，你只需解读）】");
  for (const a of analysis.micro_assessments) {
    const label = TARGET_MICRO_LABELS[a.key];
    const intakeText = a.intake != null ? `${round1(a.intake)}` : "无数据库值（请根据下方食材推算）";
    const pctText = a.achievement_rate != null ? `${Math.round(a.achievement_rate)}%` : "无法计算";
    lines.push(`- ${label}：摄入 ${intakeText}，目标 ${round1(a.dri)}，达成率 ${pctText}，评级 ${RATING_TEXT[a.rating] ?? a.rating}`);
  }
  lines.push("");
  lines.push("【今日食材清单（用于推算 Omega-3、抗炎属性、彩虹蔬果等）】");
  const mealLabel: Record<string, string> = { breakfast: "早餐", lunch: "午餐", dinner: "晚餐", snack: "加餐" };
  for (const f of analysis.foods) {
    const meal = mealLabel[f.meal_type] ?? f.meal_type;
    const amount = f.is_recipe ? `${f.servings ?? 1} 份（菜谱）` : `${f.quantity_g ?? 0}g`;
    lines.push(`- [${meal}] ${f.name}（${amount}）`);
  }
  lines.push("");
  lines.push("【系统约束】");
  lines.push("1. 上述评级与达成率已由系统计算完成，你只需解读数据并给出可操作建议，不要重新计算数值。");
  lines.push("2. Omega-3 无数据库值，请根据食材推算并明确标注推算依据。");
  lines.push(`3. Omega-3 参考 DRI 为 ${OMEGA3_DRI_G} g/天。`);
  lines.push("4. 评估「能量与控糖状态」时，热量是否充足必须以上述个人热量目标为唯一基准，并明确标注与目标的差距；禁止使用「对多数成人」「一般成年人」等泛化人群对比。");
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
    console.error("Diet analysis AI error:", err);
    return "（AI 解读失败，请稍后重试）";
  }
}

function round1(n: number): number {
  return Math.round((Number(n) || 0) * 10) / 10;
}
