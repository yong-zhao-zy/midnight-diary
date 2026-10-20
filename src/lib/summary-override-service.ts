/**
 * 摘要覆盖层（summary_overrides）读写 —— 用户手动编辑的摘要，优先级高于 AI 摘要。
 *
 * 规则（产品决策 2026-10-20）：
 *   - 显示 = override ?? AI 摘要（diaries.module_summaries）
 *   - AI 重新生成只更新自己的值，**永不改写** override
 *   - 编辑长度上限 20 字（沿用 AI 摘要 5–20 字规则）
 *   - 删除 override = 恢复 AI 摘要
 *
 * 写入后一律 `.select("id")` 校验影响行数：被 RLS 拦住时 PostgREST 不报 error、
 * 只返回 0 行，不校验会把失败当成功（见 CLAUDE.md 第 52 条）。
 */

import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

export type OverrideScope = "day" | "week" | "month";

export const OVERRIDE_SCOPES: OverrideScope[] = ["day", "week", "month"];

/** 用户编辑摘要的长度上限（日摘要沿用 AI 摘要 5–20 字规则） */
export const OVERRIDE_MAX_LEN = 20;

/** 各周期粒度的编辑上限：周/月承接更多素材，允许更长 */
export const OVERRIDE_MAX_LEN_BY_SCOPE: Record<OverrideScope, number> = {
  day: OVERRIDE_MAX_LEN,
  week: 40,
  month: 60,
};

export function overrideMaxLen(scope: OverrideScope): number {
  return OVERRIDE_MAX_LEN_BY_SCOPE[scope] ?? OVERRIDE_MAX_LEN;
}

export interface SummaryOverrideRow {
  id: string;
  scope: OverrideScope;
  period_key: string;
  module_id: string;
  content: string;
  updated_at: string;
}

/** `{ [moduleId]: content }` */
export type OverrideModuleMap = Record<string, string>;
/** `{ `${scope}:${periodKey}`: { [moduleId]: content } }` */
export type OverrideByKey = Record<string, OverrideModuleMap>;

const OVERRIDE_SELECT = "id, scope, period_key, module_id, content, updated_at";

/** 拼 store key */
export function overrideKey(scope: OverrideScope, periodKey: string): string {
  return `${scope}:${periodKey}`;
}

/** 行列表 → `{ key: { moduleId: content } }` */
export function overridesToMap(rows: SummaryOverrideRow[]): OverrideByKey {
  const map: OverrideByKey = {};
  for (const row of rows) {
    const key = overrideKey(row.scope, row.period_key);
    if (!map[key]) map[key] = {};
    map[key][row.module_id] = row.content;
  }
  return map;
}

/** 取某一 scope 下全部覆盖（RLS 已按 user_id 过滤） */
export async function fetchOverrides(
  scope: OverrideScope,
  supabase: SupabaseClient = createClient()
): Promise<SummaryOverrideRow[]> {
  const { data, error } = await supabase
    .from("summary_overrides")
    .select(OVERRIDE_SELECT)
    .eq("scope", scope);

  if (error) {
    console.error("Fetch summary overrides error:", error);
    return [];
  }
  return (data ?? []) as SummaryOverrideRow[];
}

/** 保存（新建或覆盖）一条摘要编辑 */
export async function saveOverride(
  params: { scope: OverrideScope; periodKey: string; moduleId: string; content: string },
  supabase: SupabaseClient = createClient()
): Promise<boolean> {
  const content = params.content.trim();
  const maxLen = overrideMaxLen(params.scope);
  if (!content || content.length > maxLen) return false;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from("summary_overrides")
    .upsert(
      {
        user_id: user.id,
        scope: params.scope,
        period_key: params.periodKey,
        module_id: params.moduleId,
        content,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,scope,period_key,module_id" }
    )
    .select("id");

  if (error) {
    console.error("Save summary override error:", error);
    return false;
  }
  if (!data || data.length === 0) {
    console.error("Save summary override — 0 rows affected（RLS 拦截或参数冲突）");
    return false;
  }
  return true;
}

/** 删除编辑 → 恢复显示 AI 摘要 */
export async function deleteOverride(
  params: { scope: OverrideScope; periodKey: string; moduleId: string },
  supabase: SupabaseClient = createClient()
): Promise<boolean> {
  const { data, error } = await supabase
    .from("summary_overrides")
    .delete()
    .eq("scope", params.scope)
    .eq("period_key", params.periodKey)
    .eq("module_id", params.moduleId)
    .select("id");

  if (error) {
    console.error("Delete summary override error:", error);
    return false;
  }
  // 0 行不算失败：本来就没有编辑，语义上已经「恢复 AI」
  return (data?.length ?? 0) > 0;
}

/**
 * 日记改日期时，把该日的摘要编辑迁移到新日期。
 * 摘要跟着日记走，而不是留在旧日期上。
 *
 * 目标日期理论上没有覆盖（一日一记 → 目标日期无日记），仍先清空以防唯一约束冲突。
 */
export async function moveDayOverrides(
  fromDateKey: string,
  toDateKey: string,
  supabase: SupabaseClient = createClient()
): Promise<boolean> {
  if (fromDateKey === toDateKey) return true;

  const { error: clearError } = await supabase
    .from("summary_overrides")
    .delete()
    .eq("scope", "day")
    .eq("period_key", toDateKey);

  if (clearError) {
    console.error("Move overrides — clear target error:", clearError);
    return false;
  }

  const { error } = await supabase
    .from("summary_overrides")
    .update({ period_key: toDateKey, updated_at: new Date().toISOString() })
    .eq("scope", "day")
    .eq("period_key", fromDateKey)
    .select("id");

  if (error) {
    console.error("Move overrides error:", error);
    return false;
  }
  // 旧日期本来就没有编辑 → 0 行属正常
  return true;
}
