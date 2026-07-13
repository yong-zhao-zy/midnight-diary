/**
 * 提示词实验坊 — Server-only 动态读取服务
 *
 * 纯常量与类型已抽离至 prompt-defaults.ts（客户端可 import）
 * 本文件仅保留需要 Supabase 服务端客户端的查询逻辑
 */

import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_PROMPTS,
  applyPromptVars,
  type PromptType,
} from "./prompt-defaults";

// Re-export 纯常量与类型，保持现有 import 路径兼容
export {
  DEFAULT_PROMPTS,
  PROMPT_TYPES,
  PROMPT_META,
  applyPromptVars,
  type PromptType,
  type PromptConfigRow,
} from "./prompt-defaults";

/**
 * 查询当前用户指定类型的生效 Prompt 模板（原始，未替换变量）。
 * 优先读 prompt_configs 表 is_active=true 记录；无则 fallback 到 DEFAULT_PROMPTS。
 * 获取不到用户（未登录）时优雅降级为默认模板。
 */
export async function getActivePromptTemplate(
  type: PromptType
): Promise<string> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("prompt_configs")
        .select("content")
        .eq("user_id", user.id)
        .eq("type", type)
        .eq("is_active", true)
        .eq("is_deleted", false)
        .single();
      if (data?.content) return data.content;
    }
  } catch {
    // 静默降级
  }
  return DEFAULT_PROMPTS[type];
}

/**
 * 一步到位：获取生效 Prompt 并替换占位符。
 * 各 AI 接口直接调用此函数即可拿到最终 systemPrompt。
 */
export async function getActivePrompt(
  type: PromptType,
  vars: Record<string, string>
): Promise<string> {
  const template = await getActivePromptTemplate(type);
  return applyPromptVars(template, vars);
}
