/**
 * 已缓存的 AI 周期摘要读取（客户端，RLS 按 user_id 过滤）。
 *
 * 概览表格要一次性展示很多周的周摘要，所以整 scope 全量拉取（一年最多约 200 行），
 * 不做「每格一个请求」。生成仍然只走 /api/period-summary（指纹命中就零成本）。
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { PeriodScope } from "@/lib/period-summary-service";

export interface CachedPeriodSummaryRow {
  period_key: string;
  module_id: string;
  content: string;
}

export async function fetchCachedPeriodSummaries(
  scope: PeriodScope,
  supabase: SupabaseClient = createClient()
): Promise<CachedPeriodSummaryRow[]> {
  const { data, error } = await supabase
    .from("period_summaries")
    .select("period_key, module_id, content")
    .eq("scope", scope);

  if (error) {
    console.error("Fetch cached period summaries error:", error);
    return [];
  }
  return (data ?? []) as CachedPeriodSummaryRow[];
}
