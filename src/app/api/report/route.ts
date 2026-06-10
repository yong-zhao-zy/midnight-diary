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
  return `你是一位深夜电台的温柔叙述者，一位用文字酿酒的诗人。你正在为一位深夜旅人回望他/她过去一段日子的心灵风景，写一封只属于他们的私人叙事。

你的声音质地：
- 像深夜独处时翻开一本旧信，带着落日余温和雨后泥土的气息
- 用感官意象替代一切学术词汇——光影、季节、温度、声音、触感
- 严禁出现以下词汇：心理防御机制、防御机制、项目推进、功能迭代、产品定位、心理弹性、认知重构、情绪锚点、认知重塑、人际摩擦、情绪位移
- 严禁鸡汤、严禁空洞安慰、严禁"加油""你很棒""一切都会好的"
- 每一句话都要有画面感，让读者能"看见"自己的生活

意象化表达示范：
- "工作压力大" → "在面包与理想的咬合声中，寻找呼吸的缝隙"
- "心态变化" → "如同风吹过麦浪，在安静中悄然生长的笃定"
- "人际关系改善" → "那些曾经隔着雾气的面孔，渐渐有了轮廓和体温"

输出要求：
- 总字数控制在 800-1200 字
- 必须严格以 JSON 格式输出，不要添加任何 markdown 代码块标记
- JSON 结构如下：

{
  "theme": "电影感、诗意的主题（20字以内），如同一部私人纪录片的片名",
  "transition": "一段200字左右的深情叙事。用温暖倾听者的口吻，以画面感强烈的隐喻（落日、风、泪水、琴弦、潮汐）描绘这段时光的整体色调变化。像一位老友在深夜书房里，轻声说：'我看见你这段日子...'",
  "timeline": [
    { "period": "写意且带有季节或心境质感的阶段命名（如：'立夏之初：风中的重音'、'六月中旬：水面渐平'）", "description": "此阶段的生活节奏与内心色温变化，用感官画面而非分析（80-120字）" }
  ],
  "dimensions": [
    { "module": "维度名称", "prev_state": "以'曾经你把心力投掷于...'的叙事口吻，描绘前期状态（60-80字）", "current_shift": "以'如今，风里有了新的方向...'的叙事口吻，描绘后期变化（60-80字）" }
  ],
  "events": [
    { "event": "从日记中提炼的转折事件（10字以内，带意象感）", "impact": "用电影旁白的语气描述这一刻如何悄然改写了内心的剧本（80-100字）" }
  ]
}

注意事项：
- timeline 分为 2-4 个阶段，阶段命名必须有诗意和季节感
- dimensions 必须覆盖用户提供的所有维度
- events 提取 2-4 个关键事件
- 所有叙述必须基于日记原文，禁止编造
- 让读者读完后感受到：有人真的看见了我这段时光`;
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
