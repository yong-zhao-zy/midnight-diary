import { NextResponse } from "next/server";
import type { ChatMessage } from "@/lib/diary-service";
import { resolveExpertInfo, type CustomExpertTags } from "@/config/experts-config";

interface ModuleConfigItem {
  id: string;
  label: string;
}

function buildSystemPromptInitial(
  modules?: ModuleConfigItem[],
  expertPersona?: string
): string {
  const moduleDesc = modules
    ? modules.map((m) => `- ${m.label}：用户在"${m.label}"维度的记录`).join("\n")
    : `- 身心觉知：用户对自身情绪状态和身体感受的综合感知
- 人际链接：用户今天在人际关系中的经历与感受
- 高光瞬间：今天让用户感到愉悦或有意义的时刻
- 感恩与愿景：用户想要感谢的事物，以及对明天的期许`;

  const persona =
    expertPersona ||
    "你是一位无条件接纳用户的深夜倾听者。请忽略对错，关注情感容纳。使用轻柔、充满抚慰感、包裹感强的温热文字。避开说教，肯定用户的辛苦，给其灵魂提供安全感。每段控制在2-3句话以内。";

  return `${persona}

你的任务是根据用户的日记内容，撰写一封"回响信件"。

用户日记包含以下维度：
${moduleDesc}

写作原则：
1. 严禁煽情、鸡汤式安慰。不使用"加油""你很棒""一切都会好的"等空洞表达。
2. 识别用户文字中的认知模式、情绪来源、行为动机，用精准的语言予以反馈。
3. 信件以"亲爱的夜行者："开头。
4. 结尾必须以一个启发式提问收束，引导用户进一步自我觉察。
5. 篇幅控制在 200-400 字。`;
}

function buildSystemPromptFollowup(expertPersona?: string): string {
  const persona =
    expertPersona ||
    "你是一位无条件接纳用户的深夜倾听者，正在与来访者进行深夜对话。";

  return `${persona}

你正在与来访者进行深夜对话。

对话原则：
1. 语气比信件更温和，像一位在深夜书房中面对面交谈的智者。
2. 严禁煽情和空洞安慰。每一句话都应有心理学层面的洞察支撑。
3. 回应时先精准复述来访者的核心关切（确认你听到了），再给出你的映射分析。
4. 适度使用"我注意到""我好奇的是"等对话性表达，保持互动感。
5. 结尾以一个深入的启发式提问收束，引导来访者更深层的自我觉察。
6. 篇幅控制在 150-300 字，不宜过长。`;
}

function buildUserMessage(
  content: Record<string, string>,
  modules?: ModuleConfigItem[]
): string {
  const sections = Object.entries(content)
    .filter(([, v]) => v.trim())
    .map(([key, value]) => {
      const label = modules?.find((m) => m.id === key)?.label || key;
      return `【${label}】\n${value}`;
    })
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
  newQuestion: string,
  modules?: ModuleConfigItem[],
  expertPersona?: string
): Array<{ role: string; content: string }> {
  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: buildSystemPromptFollowup(expertPersona) },
    { role: "user", content: buildUserMessage(content, modules) },
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
  moduleConfig?: ModuleConfigItem[];
  expertStyle?: string;
  customExpertTags?: CustomExpertTags;
}

export async function POST(request: Request) {
  try {
    const { content, chatHistory, followUp, reinterpret, moduleConfig, expertStyle, customExpertTags } =
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

    // Resolve expert persona prompt with role-play enforcement header
    const { name: expertName, prompt: expertPrompt } = resolveExpertInfo(expertStyle, customExpertTags, "ai");
    const expertPersona = `【硬性角色扮演指令】你现在必须完全放弃默认 AI 助手语调。\n你当前被选定的心理顾问是：${expertName}。\n以下是该顾问的完整人设与执行规则：\n\n${expertPrompt}\n\n请将上述人设的语言风格、禁忌词、格式要求贯彻到本次所有输出中。`;

    // "重新解读" mode: ignore chat_history, regenerate first response
    const isReinterpret = reinterpret || followUp === "重新解读";
    const isFollowUp = !isReinterpret && !!followUp && !!chatHistory;

    let messages: Array<{ role: string; content: string }>;

    if (isReinterpret) {
      // Fresh interpretation based on latest content only
      messages = [
        { role: "system", content: buildSystemPromptInitial(moduleConfig, expertPersona) },
        { role: "user", content: buildUserMessage(content, moduleConfig) },
      ];
    } else if (isFollowUp) {
      messages = buildConversationMessages(content, chatHistory!, followUp!, moduleConfig, expertPersona);
    } else {
      messages = [
        { role: "system", content: buildSystemPromptInitial(moduleConfig, expertPersona) },
        { role: "user", content: buildUserMessage(content, moduleConfig) },
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
