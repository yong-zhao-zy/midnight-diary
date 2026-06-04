import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface ModuleConfigItem {
  id: string;
  label: string;
}

interface RequestBody {
  diaryId: string;
  content: Record<string, string>;
  moduleConfig?: ModuleConfigItem[];
}

export async function POST(request: Request) {
  try {
    const { diaryId, content, moduleConfig } = (await request.json()) as RequestBody;

    if (!diaryId || !content) {
      return NextResponse.json({ error: "缺少参数" }, { status: 400 });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API 配置缺失" }, { status: 500 });
    }

    // Build ID → label lookup from provided moduleConfig
    const idToLabel: Record<string, string> = {};
    if (moduleConfig && moduleConfig.length > 0) {
      for (const m of moduleConfig) {
        idToLabel[m.id] = m.label;
      }
    }

    // Determine which modules have content
    const modulesToSummarize = Object.entries(content).filter(
      ([, v]) => v && v.trim().length > 0
    );

    if (modulesToSummarize.length === 0) {
      return NextResponse.json({ summaries: {} });
    }

    // Build prompt using module IDs and their labels
    const prompt = modulesToSummarize
      .map(([id, value]) => {
        const label = idToLabel[id] || id;
        return `【${label}（ID: ${id}）】\n${value.trim()}`;
      })
      .join("\n\n");

    // Build expected output format description
    const expectedKeys = modulesToSummarize.map(([id]) => `"${id}"`).join(", ");

    const systemPrompt = `你是一个温柔、克制、见解深刻的治愈系 AI 情绪观察员。
用户的输入源自语音听写，含有大量口水话（如"然后"、"就是"、"我觉得"、"那个"）、无意义重复和口语碎碎念。

你的核心任务：对原始文本进行"无损脱水"和"极致提炼"，仅保留最核心的事件与情绪。

【严格约束（不可违反）】
1. 彻底过滤：必须无情剔除所有语气词、过渡词、重复句及废话。
2. 极致限字：每个模块的总结字数必须严格限制在 5-20 个字以内（多一个字都是失败）。
3. 骨架化格式：必须使用且仅能使用以下格式提炼（优先使用格式 A）：
   - 格式 A：【事件】[极简概括] ｜ 【情绪】[精准情绪词]
   - 格式 B：因[极简事件]感到[核心情绪]

【正反例对比（严格参照）】
- 原始输入："今天那个经销商的订单一直拖着没搞定，弄得我一下午都特别烦躁，然后晚上和女朋友去吃那个日料还迟到了，心里觉得特别内疚对不起她。"
  * 错误输出 (禁止)：用户因为经销商订单没搞定很烦躁，晚上和女朋友吃饭还迟到了觉得内疚。（字数超标，且仍含口水话）
  * 正确输出 (格式 A)：【事件】订单滞后，约会迟到 ｜ 【情绪】焦虑与内疚。（共 20 字，完美）
  * 正确输出 (格式 B)：因订单滞后与约会迟到感到内疚。（共 15 字，完美）

- 原始输入："今天就是感觉整个人很累，可能昨晚没睡好，脑子空空的，什么都不想做，就在工位上发呆。"
  * 正确输出 (格式 A)：【事件】睡眠不足，状态低迷 ｜ 【情绪】疲惫疲倦。（共 19 字，完美）

【输出格式】
必须返回合法的 JSON 对象，Key 必须与用户传入的动态模块 ID 严格一一对应。Key 必须是: ${expectedKeys}

示例: {"m1":"【事件】睡眠不足 ｜ 【情绪】疲惫","m2":"因深聊感到被理解的温暖"}`;

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
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 300,
      }),
    });

    if (!res.ok) {
      console.error("DeepSeek summary API error:", res.status);
      return NextResponse.json({ error: "摘要生成失败" }, { status: 502 });
    }

    const data = await res.json();
    const rawText = data.choices?.[0]?.message?.content || "";

    // Parse JSON response from AI
    const summaries: Record<string, string> = {};
    try {
      // Extract JSON from response (handle potential markdown wrapping)
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : rawText.trim();
      const parsed = JSON.parse(jsonStr);

      for (const [key, summary] of Object.entries(parsed)) {
        if (typeof summary === "string") {
          summaries[key] = summary.slice(0, 50); // Safety truncate
        }
      }
    } catch {
      // Fallback: if JSON parse fails, generate simple truncated summaries
      console.warn("Summary JSON parse failed, raw:", rawText);
      for (const [key, value] of modulesToSummarize) {
        summaries[key] = value.trim().slice(0, 15);
      }
    }

    // Save summaries to database (keyed by module IDs: m1, m2, ...)
    const supabase = await createClient();
    await supabase
      .from("diaries")
      .update({ module_summaries: summaries })
      .eq("id", diaryId);

    return NextResponse.json({ summaries });
  } catch (error) {
    console.error("Summary route error:", error);
    return NextResponse.json({ error: "内部错误" }, { status: 500 });
  }
}
