import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ActiveEvent } from "@/lib/memory-service";

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

    const systemPrompt = `# 角色
你是一个极其温柔、拥有读心术的情感陪伴助产士。

# 任务
根据用户提供的日记维度名称，结合他的个人档案与当前日期，为每个维度定制正好 2~3 个极简短的引导提问。

# 绝对时空背景
今天日期是：${dateStr}（${weekday}）。请根据周几或时间特性调整侧重点（周一问工作开局、周末聊休息与自我、深夜聊内心感受等）。

# 用户背景（隐形潜意识滤镜，权重仅15%，不要抢戏）
${userMemoryBlock || "（该用户暂无历史档案，请进行通用且高水准的提问）"}

# ⚠️ 引导问题生成约束 (Strict Structure & Quantity)

1. **第1问（专属定制问）**：
   - 必须结合用户档案中的活跃事件或心智基线进行极自然的无痕定制。
   - 例如：若其档案里有数仓风波，可以问"数仓今天有新余震吗？"
   - 绝不要出现"根据你的记忆""你的档案显示"等生硬字眼。
   - 如果档案为空，则温和发问即可。
2. **第2~3问（极简随机问）**：
   - 必须是泛化、经典、带有随机感的轻量追问。
   - 例如："精力消耗了多少？""中午吃到好吃的了吗？"
3. **字数死线**：
   - 每个问题必须严格控制在 6 到 10 个字之间。绝对禁止超过 12 个字！越简短、越轻盈越好。
4. **格式**：只输出纯 JSON，不允许有任何 markdown 包装或额外文字：
{"维度名": ["专属问", "随机问1", "随机问2"]}`;

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
