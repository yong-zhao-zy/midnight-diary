import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MODULE_LABELS: Record<string, string> = {
  mind_body: "身心觉知",
  connection: "人际链接",
  peak_moment: "高光瞬间",
  vision: "感恩与愿景",
};

interface RequestBody {
  diaryId: string;
  content: Record<string, string>;
}

export async function POST(request: Request) {
  try {
    const { diaryId, content } = (await request.json()) as RequestBody;

    if (!diaryId || !content) {
      return NextResponse.json({ error: "缺少参数" }, { status: 400 });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API 配置缺失" }, { status: 500 });
    }

    // Generate summaries for each non-empty module
    const summaries: Record<string, string> = {};
    const modulesToSummarize = Object.entries(content).filter(
      ([, v]) => v && v.trim().length > 0
    );

    if (modulesToSummarize.length === 0) {
      return NextResponse.json({ summaries: {} });
    }

    // Build a single prompt for all modules (more efficient than multiple calls)
    const prompt = modulesToSummarize
      .map(
        ([key, value]) =>
          `【${MODULE_LABELS[key] || key}】\n${value.trim()}`
      )
      .join("\n\n");

    const systemPrompt = `你是一个精简摘要生成器。用户会提供若干日记模块内容，请为每个模块生成15字以内的精简摘要。

输出格式要求（严格JSON，不要任何其他文字）：
{"${modulesToSummarize.map(([key]) => MODULE_LABELS[key] || key).join('":"摘要","')}":"摘要"}

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
        max_tokens: 200,
      }),
    });

    if (!res.ok) {
      console.error("DeepSeek summary API error:", res.status);
      return NextResponse.json({ error: "摘要生成失败" }, { status: 502 });
    }

    const data = await res.json();
    const rawText = data.choices?.[0]?.message?.content || "";

    // Parse JSON response from AI
    try {
      const parsed = JSON.parse(rawText.trim());
      // Map back from Chinese labels to internal keys
      const labelToKey: Record<string, string> = {};
      for (const [key, label] of Object.entries(MODULE_LABELS)) {
        labelToKey[label] = key;
      }

      for (const [label, summary] of Object.entries(parsed)) {
        const key = labelToKey[label] || label;
        if (typeof summary === "string") {
          summaries[key] = summary.slice(0, 20); // Safety truncate
        }
      }
    } catch {
      // Fallback: if JSON parse fails, try to extract summaries line by line
      console.warn("Summary JSON parse failed, raw:", rawText);
      for (const [key, value] of modulesToSummarize) {
        summaries[key] = value.trim().slice(0, 15);
      }
    }

    // Save summaries to database
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
