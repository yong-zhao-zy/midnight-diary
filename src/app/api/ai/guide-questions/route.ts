import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ActiveEvent } from "@/lib/memory-service";
import { getActivePrompt } from "@/lib/prompt-templates";

interface RequestBody {
  modules: { id: string; label: string }[];
}

export async function POST(request: Request) {
  try {
    const { modules } = (await request.json()) as RequestBody;

    if (!modules || modules.length === 0) {
      return NextResponse.json(
        { error: "modules 参数不能为空" },
        { status: 400 }
      );
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI 服务暂时不可用" },
        { status: 500 }
      );
    }

    // Fetch user memory (non-blocking on failure)
    let userMemoryBlock = "";
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: memory } = await supabase
          .from("user_memories")
          .select("mental_baseline, active_events")
          .eq("user_id", user.id)
          .eq("is_deleted", false)
          .single();

        if (memory) {
          const parts: string[] = [];
          if (memory.mental_baseline) {
            parts.push(`心智基线：${memory.mental_baseline}`);
          }
          const events = memory.active_events as ActiveEvent[] | null;
          const ongoing = events?.filter((e) => e.status !== "resolved");
          if (ongoing && ongoing.length > 0) {
            const lines = ongoing
              .map((e) => `· ${e.summary}（干系人：${e.key_stakeholders}）`)
              .join("\n");
            parts.push(`活跃事件：\n${lines}`);
          }
          if (parts.length > 0) {
            userMemoryBlock = parts.join("\n");
          }
        }
      }
    } catch {
      // Memory fetch failure should not block guide question generation
    }

    const now = new Date();
    const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
    const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    const weekday = weekdays[now.getDay()];

    const moduleLabels = modules.map((m) => m.label).join("、");

    const systemPrompt = await getActivePrompt("guide", {
      dateStr,
      weekday,
      userMemoryBlock:
        userMemoryBlock || "（该用户暂无历史档案，请进行通用且高水准的提问）",
    });

    const userMessage = `请为以下维度各生成2~3个引导提问：${moduleLabels}`;

    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        temperature: 0.8,
        max_tokens: 500,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "AI 生成失败" },
        { status: 502 }
      );
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content ?? "";

    // Parse JSON from response (strip markdown fences if any)
    const cleaned = raw.replace(/```json\s*|```/g, "").trim();
    let questions: Record<string, string[]>;
    try {
      questions = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: "AI 返回格式异常", raw },
        { status: 502 }
      );
    }

    return NextResponse.json({ questions });
  } catch {
    return NextResponse.json(
      { error: "服务器内部错误" },
      { status: 500 }
    );
  }
}
