import { NextResponse } from "next/server";
import { resolveExpertInfo, type CustomExpertTags } from "@/config/experts-config";

interface DiaryEntry {
  date: string;
  content: Record<string, string>;
}

interface RequestBody {
  diaries: DiaryEntry[];
  moduleNames: Record<string, string>;
  startDate: string;
  endDate: string;
  expertStyle?: string;
  customExpertTags?: CustomExpertTags;
}

function buildSystemPrompt(expertPersona?: string): string {
  const persona = expertPersona || "你是一位睿智、温和、富有同理心的心理咨询师。";

  return `${persona}请对用户的日记原文进行深度成长剖析。

【风格规范】：
1. 务实且深刻：拒绝虚无缥缈的辞藻，必须紧扣用户日记中的具体事实（如：具体提及的事件、做出的决策、人际互动细节）。分析必须让用户感到"你真的读了我的日记"。
2. 同理心叙事：以旁观者和同行人的温暖口吻，指出用户的成长，不指责，不评判。
3. 严禁出现以下词汇：心理防御机制、防御机制、项目推进、功能迭代、产品定位、心理弹性、认知重构、情绪锚点、认知重塑、人际摩擦、情绪位移。
4. 严禁鸡汤、严禁空洞安慰、严禁"加油""你很棒""一切都会好的"等套话。

【排版与高亮规范】：
1. 简短段落：严禁大段文字堆砌！每个字段的文本必须拆分为多个简短段落，每个段落控制在 2-3 句话以内，段落之间用双换行符（\\n\\n）隔开。
2. 重点高亮：请主动在返回的文本中使用 Markdown 加粗语法（即 **重点内容**）来包裹以下内容：
   - 核心的心态转变节点
   - 深刻的自我觉察瞬间
   - 具有里程碑意义的行动或决定
   - 你给出的最核心启发
   注意：加粗内容要精准克制，只高亮关键短语，不宜整句整段加粗。

【输出 JSON 格式】：
- 总字数控制在 800-1200 字
- 必须严格以 JSON 格式输出，不要添加任何 markdown 代码块标记

{
  "theme": "20字以内，电影感的成长主题（如同一部纪录片的片名）",
  "transition": {
    "title": "用一句话概括这段时期最核心的心态转变（15字以内）",
    "description": "200字左右的深度剖析，紧扣日记中的具体事件和决策，指出用户从期初到期末的关键变化。必须拆分为2-3个简短段落，用双换行符隔开，并对核心转变点使用 **加粗** 高亮。"
  },
  "timeline": [
    { "period": "阶段命名（如：'初期：寻找节奏'、'中后期：松弛感萌芽'）", "description": "此阶段的核心变化，紧扣具体事件。拆分为2个简短段落，关键转变使用 **加粗**（80-120字）" }
  ],
  "dimensions": [
    { "module": "维度名称", "prev_state": "前期状态总结，需引用日记中的具体事实（60-80字，可使用 **加粗** 标记关键点）", "current_shift": "后期变化分析，需指出具体的行为或心态转变（60-80字，可使用 **加粗** 标记关键点）" }
  ],
  "events": [
    { "event": "从日记中提炼的关键转折事件（10字以内）", "impact": "该事件如何影响了用户的后续心态和行动。必须具体、紧扣事实，并对核心启示使用 **加粗**（80-100字）" }
  ]
}

注意事项：
- timeline 分为 2-4 个阶段
- dimensions 必须覆盖用户提供的所有维度
- events 提取 2-4 个关键事件
- 所有叙述必须基于日记原文，禁止编造
- 每个字段内的文本都要拆分为简短段落（2-3句/段），段落间用 \\n\\n 隔开`;
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
    const { diaries, moduleNames, startDate, endDate, expertStyle, customExpertTags } =
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

    const { name: expertName, prompt: expertPrompt } = resolveExpertInfo(expertStyle, customExpertTags, "report");
    const expertPersona = `【硬性角色扮演指令】你现在必须完全放弃默认 AI 助手语调。\n你当前被选定的心理顾问是：${expertName}。\n以下是该顾问的完整人设与执行规则：\n\n${expertPrompt}\n\n请将上述人设的语言风格、禁忌词、格式要求贯彻到本次所有输出中。`;

    const messages = [
      { role: "system", content: buildSystemPrompt(expertPersona) },
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
