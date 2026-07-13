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

interface ActiveEvent {
  event_id: string;
  summary: string;
  key_stakeholders: string;
  status: "ongoing" | "resolved_partially" | "resolved";
  user_cognitive_shift: string;
  created_at: string;
  resolved_at: string | null;
}

interface ExistingMemory {
  mental_baseline: string;
  recurring_patterns: string[];
  active_events: ActiveEvent[];
  mental_updated_at: string | null;
  patterns_updated_at: string | null;
  events_updated_at: string | null;
}

interface MentalResult {
  mental_baseline: string;
  recurring_patterns: string[];
}

interface EventsResult {
  active_events: ActiveEvent[];
}

const HOUR_MS = 60 * 60 * 1000;
const REFRESH_THRESHOLD_HOURS = 18;
const EVENTS_WINDOW_DAYS = 14;

/**
 * 判定是否需要跨天强制刷新。
 * 首次（无时间戳）返回 false —— 从零生成，不需要"修正与重写"。
 */
function shouldForceRefresh(updatedAt: string | null): boolean {
  if (!updatedAt) return false;
  const elapsed = Date.now() - new Date(updatedAt).getTime();
  return elapsed > REFRESH_THRESHOLD_HOURS * HOUR_MS;
}

function buildMentalSystemPrompt(
  forceMental: boolean,
  forcePatterns: boolean
): string {
  const mentalDirective = forceMental
    ? `【跨天强制刷新】距上次更新已超过 ${REFRESH_THRESHOLD_HOURS} 小时，请结合今天的最新日记，对用户的长期心智进行修正与重写，绝不沿用完全相同的旧文本。`
    : `【增量合并】将今日新信息融合进旧心智画像，保留有效旧信息，增量补充新特征。`;

  const patternsDirective = forcePatterns
    ? `【跨天强制刷新】距上次更新已超过 ${REFRESH_THRESHOLD_HOURS} 小时，请结合今天的最新日记，对用户的行为与情绪模式进行修正与重写，绝不沿用完全相同的旧文本。`
    : `【增量合并】将今日新行为融合进旧模式，保留有效旧模式，增量补充新模式。`;

  return `# 角色
你是一个极度严谨、具备深厚心理学背景的"人类记忆提取与合并专家"。

# 任务
将今日【新日记与解读】增量合并进【旧心智画像与行为模式】中，输出更新后的 JSON。

# 刷新策略
- 长期心智画像：${mentalDirective}
- 行为与情绪模式：${patternsDirective}

# 约束条件
1. 严格事实锚定：仅使用日记或解读中直接出现的客观事实，严禁推测。
2. 零前缀无痕输出：仅输出合法 JSON，严禁 markdown 代码块或解释性前缀。
3. 容量极限：recurring_patterns 最多 5 条，每条格式"模式标签：具体表现与触发场景"。
4. mental_baseline 限 150 字。

# 输出 JSON Schema
{
  "mental_baseline": "string (限 150 字)",
  "recurring_patterns": ["模式标签：具体表现与触发场景", ...]
}`;
}

function buildEventsSystemPrompt(): string {
  return `# 角色
你是一个严谨的事件梳理专家。

# 任务
基于用户最近 ${EVENTS_WINDOW_DAYS} 天的日记原文，提炼出其中**持续时间最长、出现频率最高、需要持续投入精力的 3 到 4 个核心事件/项目/主题**，构成"活跃事件时间线"。

# 物理滑动窗口规则
- 仅基于以下 ${EVENTS_WINDOW_DAYS} 天日记原文，不依赖任何旧事件状态。
- 彻底废除"AI 判定事情是否结束"的逻辑：事件是否出现在时间线，仅由"是否在 14 天窗口内被提及"决定。
- 窗口外的事件自然消失，不再保留。
- status 字段仅标注 "ongoing"（持续中）或 "resolved_partially"（部分解决/阶段性收尾），不再输出 "resolved"。

# 约束条件
1. 事件按首次出现日期先后排序。
2. summary 高度压缩事件来龙去脉（限 120 字）。
3. event_id 格式：ev_主题拼音简写_月日（如 ev_zhichang_0701）。
4. 零前缀无痕输出：仅输出合法 JSON，严禁 markdown 包裹。

# 输出 JSON Schema
{
  "active_events": [
    {
      "event_id": "ev_xxx_MMDD",
      "summary": "事件事实描述 (限 120 字)",
      "key_stakeholders": "关键干系人",
      "status": "ongoing" | "resolved_partially",
      "user_cognitive_shift": "用户对该事件的情感和认知变化轨迹",
      "created_at": "YYYY-MM-DD (首次出现日期)",
      "resolved_at": null
    }
  ]
}`;
}

function buildMentalUserPrompt(
  oldMemory: ExistingMemory,
  diaryText: string,
  aiResponse: string
): string {
  const today = new Date().toISOString().slice(0, 10);
  return `# 输入上下文
- 旧心智画像: ${oldMemory.mental_baseline || "(空)"}
- 旧行为模式: ${JSON.stringify(oldMemory.recurring_patterns)}
- 今日日记: ${diaryText}
- 今日解读: ${aiResponse}
- 当前时间: ${today}

请输出合并后的 JSON（不要包含任何 markdown 包裹）：`;
}

function buildEventsUserPrompt(diariesText: string): string {
  return `# 最近 ${EVENTS_WINDOW_DAYS} 天日记原文（按日期先后）
${diariesText}

请提炼 3-4 个核心活跃事件，输出 JSON（不要包含任何 markdown 包裹）：`;
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
    cleaned = cleaned
      .replace(/^```(?:json)?\s*\n?/, "")
      .replace(/\n?```\s*$/, "");
  }
  return cleaned.trim();
}

async function callDeepSeek<T>(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 1000
): Promise<T> {
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
      temperature: 0.3,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    throw new Error(`DeepSeek error: ${res.status}`);
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error("Empty LLM response");
  return JSON.parse(stripCodeFences(raw)) as T;
}

export async function POST(request: Request) {
  try {
    const { diaryContent, aiResponse, moduleConfig } =
      (await request.json()) as ConsolidateRequestBody;

    if (!diaryContent || !aiResponse) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "API key not configured" },
        { status: 500 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch existing memory (含新时间戳字段)
    const { data: existing } = await supabase
      .from("user_memories")
      .select(
        "mental_baseline, recurring_patterns, active_events, mental_updated_at, patterns_updated_at, events_updated_at"
      )
      .eq("user_id", user.id)
      .eq("is_deleted", false)
      .single();

    const oldMemory: ExistingMemory = {
      mental_baseline: (existing?.mental_baseline as string) ?? "",
      recurring_patterns:
        (existing?.recurring_patterns as string[]) ?? [],
      active_events: (existing?.active_events as ActiveEvent[]) ?? [],
      mental_updated_at: (existing?.mental_updated_at as string) ?? null,
      patterns_updated_at: (existing?.patterns_updated_at as string) ?? null,
      events_updated_at: (existing?.events_updated_at as string) ?? null,
    };

    // 跨天强制刷新判定
    const forceMental = shouldForceRefresh(oldMemory.mental_updated_at);
    const forcePatterns = shouldForceRefresh(oldMemory.patterns_updated_at);

    // 查询最近 14 天日记（events 物理滑动窗口）
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - (EVENTS_WINDOW_DAYS - 1));
    const windowStartStr = windowStart.toISOString().slice(0, 10);

    const { data: recentDiaries } = await supabase
      .from("diaries")
      .select("diary_date, content, module_labels_snapshot")
      .eq("user_id", user.id)
      .eq("is_deleted", false)
      .gte("diary_date", windowStartStr)
      .order("diary_date", { ascending: true });

    const diaryText = formatDiaryContent(diaryContent, moduleConfig);
    const now = new Date().toISOString();

    // 构建近 14 天日记原文文本
    const diariesText = (recentDiaries ?? [])
      .map((d) => {
        const content = d.content as Record<string, string> | null;
        const labels = d.module_labels_snapshot as
          | Record<string, string>
          | null;
        if (!content) return "";
        const body = Object.entries(content)
          .filter(([, v]) => v && v.trim())
          .map(([k, v]) => {
            const label = labels?.[k] || k;
            return `【${label}】${v}`;
          })
          .join("\n");
        return `## ${d.diary_date}\n${body}`;
      })
      .filter(Boolean)
      .join("\n\n");

    // 并行两次 LLM 调用（容错：失败的用旧值兜底）
    const [mentalRes, eventsRes] = await Promise.allSettled([
      callDeepSeek<MentalResult>(
        apiKey,
        buildMentalSystemPrompt(forceMental, forcePatterns),
        buildMentalUserPrompt(oldMemory, diaryText, aiResponse)
      ),
      diariesText.length > 0
        ? callDeepSeek<EventsResult>(
            apiKey,
            buildEventsSystemPrompt(),
            buildEventsUserPrompt(diariesText)
          )
        : Promise.resolve<EventsResult | null>(null),
    ]);

    const mentalData =
      mentalRes.status === "fulfilled" ? mentalRes.value : null;
    const eventsData =
      eventsRes.status === "fulfilled" ? eventsRes.value : null;

    if (!mentalData && !eventsData) {
      console.error("Both LLM calls failed");
      return NextResponse.json(
        { error: "LLM consolidation failed" },
        { status: 502 }
      );
    }

    // 失败的用旧值兜底，对应时间戳不更新
    const upsertPayload = {
      user_id: user.id,
      updated_at: now,
      mental_baseline: mentalData?.mental_baseline ?? oldMemory.mental_baseline,
      recurring_patterns:
        mentalData?.recurring_patterns ?? oldMemory.recurring_patterns,
      mental_updated_at: mentalData ? now : oldMemory.mental_updated_at,
      patterns_updated_at: mentalData ? now : oldMemory.patterns_updated_at,
      active_events: eventsData?.active_events ?? oldMemory.active_events,
      events_updated_at: eventsData ? now : oldMemory.events_updated_at,
    };

    const { error: upsertError } = await supabase
      .from("user_memories")
      .upsert(upsertPayload, { onConflict: "user_id" });

    if (upsertError) {
      console.error("Memory upsert error:", upsertError);
      return NextResponse.json(
        { error: "Database write failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      mentalRefreshed: !!mentalData,
      eventsRefreshed: !!eventsData,
    });
  } catch (error) {
    console.error("Consolidate memory error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
