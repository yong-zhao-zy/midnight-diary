/**
 * 全量摘要重刷脚本：将所有历史日记的 module_summaries 更新为最新的 5-20 字极简事件格式。
 *
 * 运行: npx tsx scripts/rebuild-all-summaries.ts
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local
const envPath = resolve(process.cwd(), ".env.local");
const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    process.env[match[1].trim()] = match[2].trim();
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const deepseekKey = process.env.DEEPSEEK_API_KEY!;

if (!supabaseUrl || !serviceRoleKey || !deepseekKey) {
  console.error("Missing env vars (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / DEEPSEEK_API_KEY)");
  process.exit(1);
}

// Use service role key to bypass RLS
const supabase = createClient(supabaseUrl, serviceRoleKey);

// Default module labels snapshot
const DEFAULT_LABELS: Record<string, string> = {
  m1: "身心觉知",
  m2: "人际链接",
  m3: "高光瞬间",
  m4: "感恩与愿景",
};

function buildSystemPrompt(expectedKeys: string[]): string {
  const keysStr = expectedKeys.map((k) => `"${k}"`).join(", ");
  return `你是一个温柔、克制、见解深刻的治愈系 AI 情绪观察员。
用户的输入源自语音听写，含有大量口水话（如"然后"、"就是"、"我觉得"、"那个"）、无意义重复和口语碎碎念。

你的核心任务：对原始文本进行"无损脱水"和"极致提炼"，仅保留最核心的事件与情绪。

【严格约束（不可违反）】
1. 彻底过滤：必须无情剔除所有语气词、过渡词、重复句及废话。
2. 极致限字：每个模块的总结字数必须严格限制在 5-20 个字以内（多一个字都是失败）。
3. 骨架化格式：必须使用且仅能使用以下格式提炼（优先使用格式 A）：
   - 格式 A：【事件】[极简概括] ｜ 【情绪】[精准情绪词]
   - 格式 B：因[极简事件]感到[核心情绪]

【正反例对比（严格参照）】
- 原始输入："今天那个经销商的订单一直拖着没搞定，弄得我一下午都特别烦躁，然后晚上和女朋友去吃那个日料还迟到了，心里觉得特别内疚对不起她。"
  * 错误输出 (禁止)：用户因为经销商订单没搞定很烦躁，晚上和女朋友吃饭还迟到了觉得内疚。（字数超标，且仍含口水话）
  * 正确输出 (格式 A)：【事件】订单滞后，约会迟到 ｜ 【情绪】焦虑与内疚。（共 20 字，完美）
  * 正确输出 (格式 B)：因订单滞后与约会迟到感到内疚。（共 15 字，完美）

- 原始输入："今天就是感觉整个人很累，可能昨晚没睡好，脑子空空的，什么都不想做，就在工位上发呆。"
  * 正确输出 (格式 A)：【事件】睡眠不足，状态低迷 ｜ 【情绪】疲惫疲倦。（共 19 字，完美）

【输出格式】
必须返回合法的 JSON 对象，Key 必须与用户传入的动态模块 ID 严格一一对应。Key 必须是: ${keysStr}

示例: {"m1":"【事件】睡眠不足 ｜ 【情绪】疲惫","m2":"因深聊感到被理解的温暖"}`;
}

async function callDeepSeek(content: Record<string, string>): Promise<Record<string, string>> {
  const modulesToSummarize = Object.entries(content).filter(
    ([, v]) => v && v.trim().length > 0
  );

  if (modulesToSummarize.length === 0) return {};

  const idToLabel: Record<string, string> = { ...DEFAULT_LABELS };
  const prompt = modulesToSummarize
    .map(([id, value]) => {
      const label = idToLabel[id] || id;
      return `【${label}（ID: ${id}）】\n${value.trim()}`;
    })
    .join("\n\n");

  const expectedKeys = modulesToSummarize.map(([id]) => id);
  const systemPrompt = buildSystemPrompt(expectedKeys);

  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${deepseekKey}`,
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
    throw new Error(`DeepSeek API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const rawText = data.choices?.[0]?.message?.content || "";

  const summaries: Record<string, string> = {};
  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : rawText.trim();
    const parsed = JSON.parse(jsonStr);
    for (const [key, summary] of Object.entries(parsed)) {
      if (typeof summary === "string") {
        summaries[key] = summary.slice(0, 50);
      }
    }
  } catch {
    console.warn("  JSON parse failed, fallback truncate. Raw:", rawText);
    for (const [key, value] of modulesToSummarize) {
      summaries[key] = value.trim().slice(0, 15);
    }
  }

  return summaries;
}

async function main() {
  console.log("=== 全量摘要重刷开始 ===\n");

  // Fetch all diaries
  const { data: diaries, error } = await supabase
    .from("diaries")
    .select("id, content, user_id, diary_date")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Fetch diaries failed:", error.message);
    process.exit(1);
  }

  console.log(`共找到 ${diaries.length} 条日记，开始逐条重刷...\n`);

  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < diaries.length; i++) {
    const diary = diaries[i];
    const content = diary.content as Record<string, string> | null;

    if (!content || Object.keys(content).length === 0) {
      skipped++;
      console.log(`[${i + 1}/${diaries.length}] ${diary.diary_date} - 跳过（无内容）`);
      continue;
    }

    try {
      // Call DeepSeek to regenerate summary
      const summaries = await callDeepSeek(content);

      // Build labels snapshot from content keys
      const labelsSnapshot: Record<string, string> = {};
      for (const key of Object.keys(content)) {
        labelsSnapshot[key] = DEFAULT_LABELS[key] || key;
      }

      // Update database
      const { error: updateErr } = await supabase
        .from("diaries")
        .update({
          module_summaries: summaries,
          module_labels_snapshot: labelsSnapshot,
        })
        .eq("id", diary.id);

      if (updateErr) {
        throw new Error(updateErr.message);
      }

      success++;
      console.log(`[${i + 1}/${diaries.length}] ${diary.diary_date} - OK`, summaries);

      // Rate limit: 500ms between requests
      await new Promise((r) => setTimeout(r, 500));
    } catch (err: unknown) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[${i + 1}/${diaries.length}] ${diary.diary_date} - FAILED:`, msg);
    }
  }

  console.log(`\n=== 全量摘要重刷完成 ===`);
  console.log(`成功: ${success} | 跳过: ${skipped} | 失败: ${failed} | 总计: ${diaries.length}`);
}

main();
