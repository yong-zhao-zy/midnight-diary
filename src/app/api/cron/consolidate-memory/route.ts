import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface ModuleConfigItem {
  id: string;
  label: string;
}

interface ConsolidateRequestBody {
  diaryContent: Record<string, string>;
  aiResponse: string;
  moduleConfig?: ModuleConfigItem[];
}

const CONSOLIDATION_SYSTEM_PROMPT = `# 角色
你是一个极度严谨、具备深厚心理学背景的"人类记忆提取与合并专家（Memory Consolidator）"。

# 任务
将今日发生的【新日记与解读】增量合并进【旧记忆档案】中，输出一个更新后的【新记忆档案】JSON。

# 约束条件
1. **严格的事实锚定**：只能使用直接出现在日记或解读中的客观事实。严禁基于推测发明用户没有表达过的信息。
2. **零前缀无痕输出**：必须且仅输出合法的、压缩后的标准 JSON 字符串，严禁输出任何 markdown 代码块（如 \`\`\`json）或解释性前缀。
3. **容量极限控制**：
   - \`recurring_patterns\` 最多保持 5 条。
   - \`active_events\` 最多保持 3 条活动事件。当事件状态变更为 \`resolved\` 时，若容量超限，请将已解决的事件移除。

# JSON 格式规范 (TypeScript Schema)
type ActiveEvent = {
  event_id: string;             // 唯一ID，格式：ev_主题_月日 (例如 ev_dw_conflict_0623)
  summary: string;              // 高度压缩的事件事实描述，包含来龙去脉 (限 120 字)
  key_stakeholders: string;     // 事件涉及的关键干系人 (如：数仓老大、伴侣、主管)
  status: "ongoing" | "resolved_partially" | "resolved"; // 事件当前推进状态
  user_cognitive_shift: string; // 用户对该事件的情感和认知态度变化轨迹
  created_at: string;           // 格式：YYYY-MM-DD
  resolved_at: string | null;   // 若未解决为 null，若已解决为 YYYY-MM-DD
}

type MemoryProfile = {
  mental_baseline: string;       // 用户长期的核心心智特征、性格特质 (限 150 字)
  recurring_patterns: string[];  // 行为与情绪模式（格式："模式标签：具体表现与触发场景"）
  active_events: ActiveEvent[];  // 进行中/最近刚解决的活跃事件线
}

请严格遵循上述 schema 输出 JSON。`;

function buildConsolidationUserPrompt(
  oldMemory: string,
  diaryText: string,
  aiResponse: string
): string {
  const today = new Date().toISOString().slice(0, 10);
  return `# 输入上下文
- 旧记忆档案: ${oldMemory}
- 今日日记: ${diaryText}
- 今日解读: ${aiResponse}
- 当前时间: ${today}

请输出合并后的新记忆档案 JSON（不要包含任何 markdown 包裹或额外文字）：`;
}

function formatDiaryContent(
  content: Record<string, string>,
  modules?: ModuleConfigItem[]
): string {
  return Object.entries(content)
    .filter(([, v]) => v.trim())
    .map(([key, value]) => {
      const label = modules?.find((m) => m.id === key)?.label || key;
      return `【${label}】${value}`;
    })
    .join("\n");
}

/**
 * Strip markdown code fences if the LLM wraps JSON output.
 */
function stripCodeFences(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }
  return cleaned.trim();
}

export async function POST(request: Request) {
  try {
    const { diaryContent, aiResponse, moduleConfig } =
      (await request.json()) as ConsolidateRequestBody;

    if (!diaryContent || !aiResponse) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 });
    }

    // Authenticate user
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch existing memory (may be null for first-time users)
    const { data: existingMemory } = await supabase
      .from("user_memories")
      .select("mental_baseline, recurring_patterns, active_events")
      .eq("user_id", user.id)
      .single();

    const oldMemoryJson = existingMemory
      ? JSON.stringify(existingMemory)
      : '{"mental_baseline":"","recurring_patterns":[],"active_events":[]}';

    const diaryText = formatDiaryContent(diaryContent, moduleConfig);
    const userPrompt = buildConsolidationUserPrompt(oldMemoryJson, diaryText, aiResponse);

    // Call DeepSeek for memory consolidation
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: CONSOLIDATION_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 800,
      }),
    });

    if (!res.ok) {
      console.error("DeepSeek consolidation error:", res.status);
      return NextResponse.json({ error: "LLM call failed" }, { status: 502 });
    }

    const data = await res.json();
    const rawContent = data.choices?.[0]?.message?.content;

    if (!rawContent) {
      return NextResponse.json({ error: "Empty LLM response" }, { status: 502 });
    }

    // Parse the JSON output from LLM
    const cleaned = stripCodeFences(rawContent);
    let newProfile: {
      mental_baseline: string;
      recurring_patterns: string[];
      active_events: unknown[];
    };

    try {
      newProfile = JSON.parse(cleaned);
    } catch {
      console.error("Memory consolidation JSON parse failed:", cleaned.slice(0, 200));
      return NextResponse.json({ error: "Failed to parse memory update" }, { status: 500 });
    }

    // Upsert into user_memories
    const { error: upsertError } = await supabase
      .from("user_memories")
      .upsert(
        {
          user_id: user.id,
          updated_at: new Date().toISOString(),
          mental_baseline: newProfile.mental_baseline || "",
          recurring_patterns: newProfile.recurring_patterns || [],
          active_events: newProfile.active_events || [],
        },
        { onConflict: "user_id" }
      );

    if (upsertError) {
      console.error("Memory upsert error:", upsertError);
      return NextResponse.json({ error: "Database write failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Consolidate memory error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
