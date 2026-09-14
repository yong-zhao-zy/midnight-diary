import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface BodyMetricRow {
  id: string;
  user_id: string;
  log_date: string;
  weight_kg: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  chest_cm: number | null;
  left_arm_cm: number | null;
  right_arm_cm: number | null;
  left_thigh_cm: number | null;
  right_thigh_cm: number | null;
  body_fat_pct: number | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertBodyMetricInput {
  userId: string;
  log_date: string;
  weight_kg?: number;
  waist_cm?: number;
  hip_cm?: number;
  chest_cm?: number;
  left_arm_cm?: number;
  right_arm_cm?: number;
  left_thigh_cm?: number;
  right_thigh_cm?: number;
  body_fat_pct?: number;
  note?: string;
}

export const BODY_METRIC_SELECT =
  "id, user_id, log_date, weight_kg, waist_cm, hip_cm, chest_cm, left_arm_cm, right_arm_cm, left_thigh_cm, right_thigh_cm, body_fat_pct, note, created_at, updated_at";

/** 获取日期范围内的身体数据 */
export async function fetchBodyMetricsByRange(
  userId: string,
  startDate: string,
  endDate: string,
  supabase: SupabaseClient = createClient()
): Promise<BodyMetricRow[]> {
  const { data, error } = await supabase
    .from("body_metrics")
    .select(BODY_METRIC_SELECT)
    .eq("user_id", userId)
    .eq("is_deleted", false)
    .gte("log_date", startDate)
    .lte("log_date", endDate)
    .order("log_date", { ascending: true });

  if (error) {
    console.error("Fetch body metrics by range error:", error);
    return [];
  }
  return (data ?? []) as BodyMetricRow[];
}

/** 获取最近 N 条身体数据（按日期倒序） */
export async function fetchRecentBodyMetrics(
  userId: string,
  limit: number = 30,
  supabase: SupabaseClient = createClient()
): Promise<BodyMetricRow[]> {
  const { data, error } = await supabase
    .from("body_metrics")
    .select(BODY_METRIC_SELECT)
    .eq("user_id", userId)
    .eq("is_deleted", false)
    .order("log_date", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Fetch recent body metrics error:", error);
    return [];
  }
  return (data ?? []) as BodyMetricRow[];
}

/** Upsert 身体数据（一天一条，靠 UNIQUE(user_id, log_date) 约束覆盖） */
export async function upsertBodyMetric(
  input: UpsertBodyMetricInput,
  supabase: SupabaseClient = createClient()
): Promise<BodyMetricRow | null> {
  const payload = {
    user_id: input.userId,
    log_date: input.log_date,
    weight_kg: input.weight_kg ?? null,
    waist_cm: input.waist_cm ?? null,
    hip_cm: input.hip_cm ?? null,
    chest_cm: input.chest_cm ?? null,
    left_arm_cm: input.left_arm_cm ?? null,
    right_arm_cm: input.right_arm_cm ?? null,
    left_thigh_cm: input.left_thigh_cm ?? null,
    right_thigh_cm: input.right_thigh_cm ?? null,
    body_fat_pct: input.body_fat_pct ?? null,
    note: input.note ?? null,
  };

  const { data, error } = await supabase
    .from("body_metrics")
    .upsert(payload, { onConflict: "user_id,log_date" })
    .select(BODY_METRIC_SELECT)
    .single();

  if (error || !data) {
    console.error("Upsert body metric error:", error);
    return null;
  }
  return data as BodyMetricRow;
}

/** 物理删除身体数据（body_metrics 不需要软删，直接 DELETE） */
export async function deleteBodyMetric(
  id: string,
  supabase: SupabaseClient = createClient()
): Promise<boolean> {
  const { error } = await supabase.from("body_metrics").delete().eq("id", id);

  if (error) {
    console.error("Delete body metric error:", error);
    return false;
  }
  return true;
}
