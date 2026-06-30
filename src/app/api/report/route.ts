import { NextResponse } from "next/server";
import { resolveExpertInfo, type CustomExpertTags } from "@/config/experts-config";
import { getActivePrompt } from "@/lib/prompt-templates";

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

async function buildSystemPrompt(expertPersona?: string): Promise<string> {
  const persona = expertPersona || "你是一位睿智、温和、富有同理心的心理咨询师。";
  return getActivePrompt("report", { persona });
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
    const expertPersona = `【硬性角色扮演指令】你现在必须完全放弃默认 AI 助手语调。\n你当前被选定的心理顾问是：${expertName}。\n以下是该顾问的完整人设与执行规则：\n\n${expertPrompt}\n\n请将上述人设的语言风格、禁忌词、格式要求贯彻到本次所有输出中。以上风格规则适用于遣词造句，不限制输出长度，请保持与原有解读同等的内容深度和篇幅。`;

    const messages = [
      { role: "system", content: await buildSystemPrompt(expertPersona) },
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
