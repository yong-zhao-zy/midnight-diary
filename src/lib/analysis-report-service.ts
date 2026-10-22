/**
 * AI 饮食分析报告快照存取（【饮食-今日饮食分析】+【分析-周期解读】共用）
 *
 * 表：public.ai_analysis_reports（迁移脚本 20261022_ai_analysis_reports.sql）
 *   scope='day'    → period_key = 'YYYY-MM-DD'
 *   scope='period' → period_key = 'YYYY-MM-DD_YYYY-MM-DD'
 *
 * 表不存在（迁移未执行）时不阻塞主流程：读取返回 null、写入静默失败。
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const TABLE = "ai_analysis_reports";

export type ReportScope = "day" | "period";

export interface StoredReport<T> {
  report: string;
  payload: T | null;
  generatedAt: string;
}

export function dayKey(date: string): string {
  return date;
}

export function periodKey(startDate: string, endDate: string): string {
  return `${startDate}_${endDate}`;
}

/**
 * 只封存「真的由模型生成的」报告。
 * interpretWithAI 失败时会返回「（AI 解读暂不可用…）」这类占位文案，
 * 存下来就会永久顶掉这个日期的报告，所以这类一律不落库。
 */
export function isUsableReport(report: string): boolean {
  const text = report.trim();
  return text.length > 0 && !text.startsWith("（AI");
}

export async function fetchStoredReport<T>(
  supabase: SupabaseClient,
  scope: ReportScope,
  key: string
): Promise<StoredReport<T> | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("report, payload, generated_at")
    .eq("scope", scope)
    .eq("period_key", key)
    .maybeSingle();

  if (error) {
    // 42P01 = 表不存在（迁移还没跑），不刷错误日志
    if (error.code !== "42P01") {
      console.error("[analysis-report] fetch failed:", error.message);
    }
    return null;
  }
  if (!data) return null;

  return {
    report: data.report as string,
    payload: (data.payload as T) ?? null,
    generatedAt: data.generated_at as string,
  };
}

export async function saveStoredReport(
  supabase: SupabaseClient,
  params: {
    userId: string;
    scope: ReportScope;
    key: string;
    report: string;
    payload: unknown;
  }
): Promise<string | null> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(
      {
        user_id: params.userId,
        scope: params.scope,
        period_key: params.key,
        report: params.report,
        payload: params.payload,
        generated_at: now,
        updated_at: now,
      },
      { onConflict: "user_id,scope,period_key" }
    )
    .select("generated_at")
    .maybeSingle();

  if (error) {
    if (error.code !== "42P01") {
      console.error("[analysis-report] save failed:", error.message);
    }
    return null;
  }
  return (data?.generated_at as string) ?? now;
}
