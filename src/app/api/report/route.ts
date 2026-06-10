import { NextResponse } from "next/server";

interface DiaryEntry {
  date: string;
  content: Record<string, string>;
}

interface RequestBody {
  diaries: DiaryEntry[];
  moduleNames: Record<string, string>;
  startDate: string;
  endDate: string;
}

function buildSystemPrompt(): string {
  return `你是一位深具洞察力、极富同理心的心理分析师与文字叙事者。你正在为来访者撰写一份阶段性心理成长报告。

你的写作风格：
- 优雅温暖，避免 KPI 式评分或冷冰冰的折线图叙述
- 像一封来自深夜书房的长信，带有文学性和心理学深度
- 严禁鸡汤、严禁空洞安慰、严禁使用"加油""你很棒"等套话
- 用精准的心理学语言描述内心变化，如"认知重构""情绪锚点""心理弹性"等

输出要求：
- 总字数控制在 800-1200 字
- 必须严格以 JSON 格式输出，不要添加任何 markdown 代码块标记
- JSON 结构如下：

{
  "theme": "用8个字以内提炼这段时期的核心成长主题",
  "transition": "【核心心态位移】一段200字左右的深情叙事，描述用户从期初到期末的生活与心态整体转变。像一位老友回望这段旅程，指出那些微妙却重要的变化。",
  "timeline": [
    { "period": "阶段描述（如：前期/中期/后期，或具体日期段）", "description": "此阶段的核心心态、关键变化与生活节奏（80-120字）" }
  ],
  "dimensions": [
    { "module": "维度名称", "prev_state": "前期状态与精力投入重心总结（60-80字）", "current_shift": "后期心态位移与变化，需具体到行为或认知层面的转变（60-80字）" }
  ],
  "events": [
    { "event": "从日记中提炼的重要转折事件名（10字以内）", "impact": "该事件对用户内心成长的深远影响分析（80-100字，从心理学视角解读）" }
  ]
}

注意事项：
- timeline 分为 2-4 个阶段
- dimensions 必须覆盖用户提供的所有维度
- events 提取 2-4 个关键事件
- 所有叙述必须基于日记原文，禁止编造`;
}

function buildUserMessage(
  diaries: DiaryEntry[],
  moduleNames: Record<string, string>,
  startDate: string,
  endDate: string
): string {
  const header = `以下是我从 ${startDate} 到 ${endDate} 的日记记录（共 ${diaries.length} 篇），请为我撰写阶段性心理成长报告。\n\n`;

  const moduleDesc = `我的日记维度：${Object.entries(moduleNames)
    .map(([, name]) => name)
    .join("、")}\n\n`;

  const entries = diaries
    .map((d) => {
      const sections = Object.entries(d.content)
        .filter(([, v]) => v && v.trim())
        .map(([key, value]) => {
          const label = moduleNames[key] || key;
          return `  【${label}】${value}`;
        })
        .join("\n");
      return `--- ${d.date} ---\n${sections}`;
    })
    .join("\n\n");

  return header + moduleDesc + entries;
}

export async function POST(request: Request) {
  try {
    const { diaries, moduleNames, startDate, endDate } =
      (await request.json()) as RequestBody;

    if (!diaries || diaries.length === 0) {
      return NextResponse.json(
        { message: "这段时间没有日记记录，无法生成报告。" },
        { status: 400 }
      );
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { message: "今晚的信使暂时离开了，请稍后再试。" },
        { status: 500 }
      );
    }

    const messages = [
      { role: "system", content: buildSystemPrompt() },
      {
        role: "user",
        content: buildUserMessage(diaries, moduleNames, startDate, endDate),
      },
    ];

    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages,
        temperature: 0.6,
        max_tokens: 2000,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("DeepSeek API error:", errorText);
      return NextResponse.json(
        { message: "深空信号暂时中断，请稍后再试。" },
        { status: 502 }
      );
    }

    const json = await res.json();
    const raw = json.choices?.[0]?.message?.content ?? "";

    // Strip markdown code fences if present
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    try {
      const content = JSON.parse(cleaned);
      return NextResponse.json({ content });
    } catch {
      console.error("Failed to parse report JSON:", cleaned);
      return NextResponse.json(
        { message: "报告生成格式异常，请重试。", raw: cleaned },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error("Report generation error:", err);
    return NextResponse.json(
      { message: "报告生成失败，请稍后再试。" },
      { status: 500 }
    );
  }
}
