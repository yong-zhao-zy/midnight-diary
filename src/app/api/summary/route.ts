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

    const systemPrompt = `你是一个精简摘要生成器。用户会提供若干日记模块内容，请为每个模块生成15字以内的精简摘要。

输出格式要求（严格JSON，不要任何其他文字）：
使用每个模块的 ID 作为 Key，生成对应摘要。Key 必须是: ${expectedKeys}

示例格式: {"m1":"今天身体疲惫但心情平静","m2":"和朋友聊了很久"}

摘要原则：
- 每个摘要15字以内
- 描述该模块的核心内容
- 不要前缀、不要解释、不要标点符号堆砌`;

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
          summaries[key] = summary.slice(0, 20); // Safety truncate
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
