import { NextResponse } from "next/server";
import type { ChatMessage } from "@/lib/diary-service";

const SYSTEM_PROMPT_INITIAL = `你是一位专业、理性、克制的心理咨询专家。你的任务是根据用户的日记内容，撰写一封"回响信件"。

写作原则：
1. 严禁煽情、鸡汤式安慰。不使用"加油""你很棒""一切都会好的"等空洞表达。
2. 使用逻辑化的心理映射：识别用户文字中的认知模式、情绪来源、行为动机，用精准的语言予以反馈。
3. 语气如同一位深夜书房中安静陪坐的智者——不急于给答案，而是照亮问题的结构。
4. 信件以"亲爱的夜行者："开头。
5. 结尾必须以一个启发式提问收束，引导用户进一步自我觉察。
6. 篇幅控制在 200-400 字。`;

const SYSTEM_PROMPT_FOLLOWUP = `你是一位专业、理性、克制的心理咨询专家，正在与来访者进行深夜对话。

对话原则：
1. 保持理性与专业，但语气比信件更温和，像一位在深夜书房中面对面交谈的智者。
2. 严禁煽情和空洞安慰。每一句话都应有心理学层面的洞察支撑。
3. 回应时先精准复述来访者的核心关切（确认你听到了），再给出你的映射分析。
4. 适度使用"我注意到""我好奇的是"等对话性表达，保持互动感。
5. 结尾以一个深入的启发式提问收束，引导来访者更深层的自我觉察。
6. 篇幅控制在 150-300 字，不宜过长。`;

const MODULE_LABELS: Record<string, string> = {
  emotion: "情绪状态",
  body: "身体感知",
  social: "人际关系",
  light: "今日微光",
  challenge: "明日挑战",
};

function buildUserMessage(content: Record<string, string>): string {
  const sections = Object.entries(content)
    .filter(([, v]) => v.trim())
    .map(([key, value]) => `【${MODULE_LABELS[key] || key}】\n${value}`)
    .join("\n\n");

  return `以下是我今晚的日记记录：\n\n${sections}`;
}

/**
 * Convert chat_history + diary content into DeepSeek messages array
 * for multi-turn conversation context.
 */
function buildConversationMessages(
  content: Record<string, string>,
  chatHistory: ChatMessage[],
  newQuestion: string
): Array<{ role: string; content: string }> {
  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: SYSTEM_PROMPT_FOLLOWUP },
    { role: "user", content: buildUserMessage(content) },
  ];

  for (const msg of chatHistory) {
    if (msg.type === "reference") continue;
    if (msg.type === "ai") {
      messages.push({ role: "assistant", content: msg.content });
    } else if (msg.type === "user") {
      messages.push({ role: "user", content: msg.content });
    }
  }

  messages.push({ role: "user", content: newQuestion });

  return messages;
}

interface RequestBody {
  content: Record<string, string>;
  chatHistory?: ChatMessage[];
  followUp?: string;
  reinterpret?: boolean;
}

export async function POST(request: Request) {
  try {
    const { content, chatHistory, followUp, reinterpret } =
      (await request.json()) as RequestBody;

    if (!content || Object.values(content).every((v) => !v.trim())) {
      return NextResponse.json(
        { message: "你似乎还没有写下什么。试着回到前面，哪怕只写一句也好。" },
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

    // "重新解读" mode: ignore chat_history, regenerate first response
    const isReinterpret = reinterpret || followUp === "重新解读";
    const isFollowUp = !isReinterpret && !!followUp && !!chatHistory;

    let messages: Array<{ role: string; content: string }>;

    if (isReinterpret) {
      // Fresh interpretation based on latest content only
      messages = [
        { role: "system", content: SYSTEM_PROMPT_INITIAL },
        { role: "user", content: buildUserMessage(content) },
      ];
    } else if (isFollowUp) {
      messages = buildConversationMessages(content, chatHistory!, followUp!);
    } else {
      messages = [
        { role: "system", content: SYSTEM_PROMPT_INITIAL },
        { role: "user", content: buildUserMessage(content) },
      ];
    }

    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages,
        temperature: 0.7,
        max_tokens: isFollowUp ? 600 : 800,
      }),
    });

    if (!res.ok) {
      console.error("DeepSeek API error:", res.status, await res.text());
      return NextResponse.json(
        { message: "夜色太深，信号短暂中断了。请稍后再试一次。" },
        { status: 502 }
      );
    }

    const data = await res.json();
    const message =
      data.choices?.[0]?.message?.content ||
      "今晚的回信未能送达，但你写下的每一个字都已被记录。";

    return NextResponse.json({ message, isReinterpret });
  } catch (error) {
    console.error("AI route error:", error);
    return NextResponse.json(
      { message: "深夜的邮差迷了路，请稍后再试。" },
      { status: 500 }
    );
  }
}
