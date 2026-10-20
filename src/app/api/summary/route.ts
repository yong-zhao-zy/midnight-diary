import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActivePrompt } from "@/lib/prompt-templates";
import { refreshWeekForDate } from "@/lib/period-summary-server";

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

    const systemPrompt = await getActivePrompt("summary", { expectedKeys });

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
    const { data: updatedDiary } = await supabase
      .from("diaries")
      .update({ module_summaries: summaries })
      .eq("id", diaryId)
      .select("diary_date, created_at")
      .single();

    // 日摘要变了 → 顺手刷新该日所属的周摘要（不阻塞响应；失败则由下次打开弹窗时按指纹重算）
    scheduleWeekRefresh(updatedDiary, moduleConfig);

    return NextResponse.json({ summaries });
  } catch (error) {
    console.error("Summary route error:", error);
    return NextResponse.json({ error: "内部错误" }, { status: 500 });
  }
}

function toDateKey(createdAt: string | undefined, diaryDate: string | null | undefined): string | null {
  if (diaryDate) return diaryDate;
  if (!createdAt) return null;
  const d = new Date(createdAt);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/**
 * 后台刷新周摘要：需求「日摘要生成后自动生成对应的周/月摘要」。
 * 用 next/server 的 after() 在响应发出后执行，避免拖慢保存体验。
 */
function scheduleWeekRefresh(
  updatedDiary: { diary_date?: string | null; created_at?: string } | null,
  moduleConfig: ModuleConfigItem[] | undefined
): void {
  if (!updatedDiary || !moduleConfig || moduleConfig.length === 0) return;
  const dateKey = toDateKey(updatedDiary.created_at, updatedDiary.diary_date);
  if (!dateKey) return;

  const modules = moduleConfig.map((m) => ({ id: m.id, label: m.label }));

  after(async () => {
    try {
      // 响应发出后再建客户端：请求级的 cookie store 此时已不可靠
      const client = await createClient();
      const {
        data: { user },
      } = await client.auth.getUser();
      if (!user) return;
      await refreshWeekForDate(client, user.id, dateKey, modules);
    } catch (error) {
      console.error("Refresh week summary failed (non-blocking):", error);
    }
  });
}
