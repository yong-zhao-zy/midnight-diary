import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface ChatMessage {
  type: "reference" | "user" | "ai";
  label: string;
  content: string;
}

const BACKFILL_SYSTEM_PROMPT = `# 角色
你是一位拥有顶级洞察力的心理咨询专家与记忆梳理大师。

# 任务
请你深度、正序阅读用户过去所有的历史日记与解读，为用户提炼出一份截至当前时间（2026年6月24日）的最精准、无噪声的"动态记忆档案 (Memory Profile)"。

# 约束条件与时空对齐
1. **严格的时空锚定**：
   - 当前绝对时间：**2026年6月24日 21:25:30.942**。
   - 在梳理事件时间线时，请严格进行时空换算：今年 = 2026年，明年 = 2027年，去年 = 2025年。
   - 如果日记中写"上个月"，请根据该篇日记的日期进行换算，最终在 JSON 档案中必须以绝对日期（如 YYYY-MM-DD）或相对当下的准确时间存储。
2. **严格的事实锚定**：只能使用历史日记或解读中明确出现过的事实。严禁凭空捏造事件、时间、人物或因果关系。
3. **输出格式**：仅输出压缩后的标准 JSON，严禁输出 Markdown 标记（如 \`\`\`json）或任何解释性前缀。

# JSON 格式规范
type ActiveEvent = {
  event_id: string;             // 唯一ID，格式：ev_主题_月日 (例如 ev_dw_conflict_0623)
  summary: string;              // 事实描述，写清来龙去脉和核心人物 (限 120 字)
  key_stakeholders: string;     // 事件涉及的关键干系人 (如：数仓老大、伴侣、主管)
  status: "ongoing" | "resolved_partially" | "resolved"; // 截至 2026年6月24日 该事件的状态
  user_cognitive_shift: string; // 经历这件事后，用户情感和认知的转变轨迹
  created_at: string;           // 事件首次出现的 YYYY-MM-DD
  resolved_at: string | null;   // 若未解决为 null，若已解决写具体日期 YYYY-MM-DD
}

type MemoryProfile = {
  mental_baseline: string;       // 用户长期、根深蒂固的核心心智特征、性格敏感点 (限 150 字)
  recurring_patterns: string[];  // 行为与情绪模式（格式："模式标签：具体表现与触发场景"，最多 5 条）
  active_events: ActiveEvent[];  // 截至 2026年6月24日 仍未解决，或最近刚刚解决（具有深远影响）的事件线（最多 3 条）
}`;

function stripCodeFences(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }
  return cleaned.trim();
}

export async function POST() {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 });
    }

    // 1. Authenticate
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Fetch all historical diaries (ASC order)
    const { data: diaries, error: diaryErr } = await supabase
      .from("diaries")
      .select("content, chat_history, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (diaryErr) {
      return NextResponse.json({ error: "Failed to fetch diaries", detail: diaryErr.message }, { status: 500 });
    }

    if (!diaries || diaries.length === 0) {
      return NextResponse.json({ error: "No diaries found for this user" }, { status: 404 });
    }

    // 3. Format historical data into text series
    const historySeries = diaries.map((diary) => {
      const date = diary.created_at?.slice(0, 10) || "unknown";

      // Extract diary content text
      const content = diary.content as Record<string, string> | null;
      const diaryText = content
        ? Object.entries(content)
            .filter(([, v]) => v?.trim())
            .map(([, v]) => v)
            .join("\n")
        : "";

      // Extract AI responses from chat_history
      const chatHistory = (diary.chat_history as ChatMessage[]) || [];
      const aiResponses = chatHistory
        .filter((msg) => msg.type === "ai")
        .map((msg) => msg.content)
        .join("\n");

      return `[${date}]\n日记原文：${diaryText}\nAI解读：${aiResponses}\n------------------`;
    }).join("\n\n");

    // 4. Call DeepSeek with backfill prompt
    const userPrompt = `# 用户的历史日记与解读序列（已按时间正序排列）：\n\n${historySeries}`;

    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: BACKFILL_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 1500,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("DeepSeek backfill error:", res.status, errText);
      return NextResponse.json({ error: "LLM call failed", status: res.status }, { status: 502 });
    }

    const data = await res.json();
    const rawContent = data.choices?.[0]?.message?.content;

    if (!rawContent) {
      return NextResponse.json({ error: "Empty LLM response" }, { status: 502 });
    }

    // 5. Parse JSON output
    const cleaned = stripCodeFences(rawContent);
    let memoryProfile: {
      mental_baseline: string;
      recurring_patterns: string[];
      active_events: unknown[];
    };

    try {
      memoryProfile = JSON.parse(cleaned);
    } catch {
      console.error("Backfill JSON parse failed:", cleaned.slice(0, 300));
      return NextResponse.json({ error: "Failed to parse LLM output", raw: cleaned.slice(0, 500) }, { status: 500 });
    }

    // 6. Upsert into user_memories
    const { error: upsertError } = await supabase
      .from("user_memories")
      .upsert(
        {
          user_id: user.id,
          updated_at: new Date().toISOString(),
          mental_baseline: memoryProfile.mental_baseline || "",
          recurring_patterns: memoryProfile.recurring_patterns || [],
          active_events: memoryProfile.active_events || [],
        },
        { onConflict: "user_id" }
      );

    if (upsertError) {
      console.error("Backfill upsert error:", upsertError);
      return NextResponse.json({ error: "Database write failed", detail: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      diariesProcessed: diaries.length,
      memory: memoryProfile,
    });
  } catch (error) {
    console.error("Backfill error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
