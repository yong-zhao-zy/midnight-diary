import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getFoodById, type FoodRow } from "@/lib/food-service";
import { fetchHealthProfile } from "@/lib/health-profile-service";
import { getPersonalizedDRI } from "@/config/dri-config";
import { NUTRIENT_LABELS, NUTRIENT_UNITS, type NutrientKey } from "@/config/dri-config";
import { evaluateFood } from "@/lib/food-evaluation";
import { fetchBodyMetricsByRange } from "@/lib/body-metric-service";
import { todayShanghaiStr, minusOneDay } from "@/lib/date-utils";

/**
 * POST /api/foods/[id]/evaluate
 * 服务端用规则引擎算出结构化标签后，交 DeepSeek 做自然语言点评。
 * 规则引擎结果始终返回（即时）；AI 点评按需返回（点了才调）。
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const food = await getFoodById(id, supabase);
    if (!food) {
      return NextResponse.json({ error: "食物不存在" }, { status: 404 });
    }

    // 取画像 + 最近体重算个性化 DRI（无画像时 dri=null，评价引擎走兜底）
    const profile = await fetchHealthProfile(supabase);
    const endDate = todayShanghaiStr();
    const startDate = minusOneDay(minusOneDay(minusOneDay(minusOneDay(minusOneDay(minusOneDay(minusOneDay(endDate)))))));
    const bodyMetrics = await fetchBodyMetricsByRange(user.id, startDate, endDate, supabase);
    const latestWeight = bodyMetrics.find((m) => m.weight_kg != null)?.weight_kg ?? null;
    const dri = latestWeight != null ? getPersonalizedDRI(profile, latestWeight) : null;

    // 规则引擎：结构化标签（即时，免费）
    const evaluation = evaluateFood(food, dri);

    // AI 自然语言点评（按需，本次请求即调）
    const aiComment = await commentWithAI(food, evaluation);

    return NextResponse.json({ success: true, evaluation, aiComment });
  } catch (error) {
    console.error("[api/foods/[id]/evaluate POST] error:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}

async function commentWithAI(
  food: FoodRow,
  evaluation: ReturnType<typeof evaluateFood>
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return "（AI 点评暂不可用，请在服务端配置 DEEPSEEK_API_KEY）";
  }

  const nutrientLines: string[] = [];
  const keys: NutrientKey[] = [
    "energy_kcal", "protein_g", "fat_g", "carb_g", "fiber_g",
    "sodium_mg", "potassium_mg", "calcium_mg", "iron_mg", "vit_c_mg",
  ];
  for (const key of keys) {
    const v = (food as unknown as Record<NutrientKey, number | null>)[key];
    if (v == null) continue;
    nutrientLines.push(`- ${NUTRIENT_LABELS[key]}：${v}${NUTRIENT_UNITS[key]}/100g`);
  }

  const tagLines = evaluation.all_tags
    .map((t) => `- ${t.label}${t.detail ? `（${t.detail}）` : ""}`)
    .join("\n");

  const userPrompt = `食物名称：${food.name}
食物类别：${food.category ?? "其他"}
默认份量：${food.default_serving_g}g（${food.default_serving_name}）

每 100g 营养素：
${nutrientLines.join("\n")}

系统评价标签：
${tagLines}`;

  const systemPrompt = `你是一位专业营养师。基于以下食物的营养数据和系统已算出的标签，给用户一段简短、温和的食物点评。

要求：
- 用中文，总字数 150 字以内
- 不要重新计算数值，基于系统标签做自然语言解读
- 说明这种食物适合什么场景吃、搭配什么更健康、需要注意什么
- 语气亲切专业，不要用 markdown 代码块
- 开头直接说这种食物的特点，不要"这个食物"之类的指代`;

  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.5,
        max_tokens: 400,
      }),
    });

    if (!res.ok) {
      console.error("DeepSeek API error:", await res.text());
      return "（AI 点评暂时不可用，请稍后重试）";
    }

    const json = await res.json();
    const text = json.choices?.[0]?.message?.content ?? "";
    return text.trim() || "（AI 未返回内容）";
  } catch (err) {
    console.error("Food evaluate AI error:", err);
    return "（AI 点评失败，请稍后重试）";
  }
}
