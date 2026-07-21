import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PracticeStatus = "active" | "completed";
export type PracticeSourceType = "ai_interpretation" | "manual";
export type CheckinAction = "checkin" | "uncheckin";

export interface PracticeRow {
  id: string;
  user_id: string;
  title: string;
  source_type: PracticeSourceType;
  source_diary_id: string | null;
  source_diary_date: string | null;
  status: PracticeStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PracticeLogRow {
  id: string;
  user_id: string;
  practice_id: string;
  practiced_at: string; // YYYY-MM-DD
  created_at: string;
}

export interface PracticeStats {
  total_days: number;
  consecutive_days: number;
}

export interface CreatePracticeInput {
  userId: string;
  title: string;
  source_type: PracticeSourceType;
  source_diary_id?: string;
}

const PRACTICE_SELECT = "id, user_id, title, source_type, source_diary_id, source_diary_date, status, completed_at, created_at, updated_at";

/**
 * Get today's local date as YYYY-MM-DD (independent of server timezone).
 */
function todayLocalStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Subtract one day from a YYYY-MM-DD string.
 */
function minusOneDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/**
 * Fetch practices filtered by status for a user.
 */
export async function fetchPracticesByStatus(
  userId: string,
  status: PracticeStatus,
  supabase: SupabaseClient = createClient()
): Promise<PracticeRow[]> {
  const { data, error } = await supabase
    .from("practices")
    .select(PRACTICE_SELECT)
    .eq("user_id", userId)
    .eq("is_deleted", false)
    .eq("status", status)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(`Fetch practices (${status}) error:`, error);
    return [];
  }

  return (data ?? []) as PracticeRow[];
}

/**
 * Create a new practice.
 * If source_diary_id is provided, verifies ownership + denormalizes diary_date.
 */
export async function createPractice(
  input: CreatePracticeInput,
  supabase: SupabaseClient = createClient()
): Promise<PracticeRow | null> {

  const insertPayload: Record<string, unknown> = {
    user_id: input.userId,
    title: input.title,
    source_type: input.source_type,
  };

  if (input.source_diary_id) {
    const { data: diary, error: diaryErr } = await supabase
      .from("diaries")
      .select("user_id, diary_date")
      .eq("id", input.source_diary_id)
      .eq("is_deleted", false)
      .single();

    if (diaryErr || !diary) {
      console.error("Create practice: source diary not found:", diaryErr);
      return null;
    }
    if (diary.user_id !== input.userId) {
      console.error("Create practice: source diary not owned");
      return null;
    }

    insertPayload.source_diary_id = input.source_diary_id;
    insertPayload.source_diary_date = diary.diary_date || null;
  }

  const { data, error } = await supabase
    .from("practices")
    .insert(insertPayload)
    .select(PRACTICE_SELECT)
    .single();

  if (error || !data) {
    console.error("Create practice error:", error);
    return null;
  }

  return data as PracticeRow;
}

/**
 * Update practice title (Q3 confirmed — overwrite).
 */
export async function updatePracticeTitle(
  id: string,
  title: string,
  supabase: SupabaseClient = createClient()
): Promise<PracticeRow | null> {
  const { data, error } = await supabase
    .from("practices")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("is_deleted", false)
    .select(PRACTICE_SELECT)
    .single();

  if (error || !data) {
    console.error("Update practice title error:", error);
    return null;
  }

  return data as PracticeRow;
}

/**
 * Complete a practice — set status='completed' + completed_at=now().
 */
export async function completePractice(
  id: string,
  supabase: SupabaseClient = createClient()
): Promise<PracticeRow | null> {
  const { data, error } = await supabase
    .from("practices")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("is_deleted", false)
    .eq("status", "active")
    .select(PRACTICE_SELECT)
    .single();

  if (error || !data) {
    console.error("Complete practice error:", error);
    return null;
  }

  return data as PracticeRow;
}

/**
 * Soft-delete a practice + cascade soft-delete all its practice_logs.
 * Performed as two sequential UPDATEs (Supabase JS client does not support
 * multi-table transactions; the ON DELETE CASCADE FK only handles physical DELETE).
 */
export async function softDeletePractice(
  id: string,
  supabase: SupabaseClient = createClient()
): Promise<boolean> {
  // Step 1: soft-delete all practice_logs for this practice
  const { error: logsErr } = await supabase
    .from("practice_logs")
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq("practice_id", id)
    .eq("is_deleted", false);

  if (logsErr) {
    console.error("Soft-delete practice_logs error:", logsErr);
    return false;
  }

  // Step 2: soft-delete the practice itself
  const { error: practiceErr } = await supabase
    .from("practices")
    .update({ is_deleted: true, deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("is_deleted", false);

  if (practiceErr) {
    console.error("Soft-delete practice error:", practiceErr);
    return false;
  }

  return true;
}

/**
 * Toggle checkin for a practice on a specific date.
 *   action='checkin': insert new log OR revive soft-deleted log (idempotent)
 *   action='uncheckin': soft-delete existing log (idempotent)
 * Returns updated stats (total_days, consecutive_days).
 */
export async function toggleCheckin(
  practiceId: string,
  date: string,
  action: CheckinAction,
  supabase: SupabaseClient = createClient()
): Promise<PracticeStats | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Look up existing log for (user, practice, date) — includes soft-deleted
  const { data: existing } = await supabase
    .from("practice_logs")
    .select("id, is_deleted")
    .eq("user_id", user.id)
    .eq("practice_id", practiceId)
    .eq("practiced_at", date)
    .limit(1);

  const log = existing && existing.length > 0 ? existing[0] : null;

  if (action === "checkin") {
    if (!log) {
      // Insert new log
      const { error } = await supabase.from("practice_logs").insert({
        user_id: user.id,
        practice_id: practiceId,
        practiced_at: date,
      });
      if (error) {
        console.error("Checkin insert error:", error);
        return null;
      }
    } else if (log.is_deleted) {
      // Revive soft-deleted log
      const { error } = await supabase
        .from("practice_logs")
        .update({ is_deleted: false, deleted_at: null })
        .eq("id", log.id);
      if (error) {
        console.error("Checkin revive error:", error);
        return null;
      }
    }
    // else: already checked in — idempotent
  } else if (action === "uncheckin") {
    if (log && !log.is_deleted) {
      const { error } = await supabase
        .from("practice_logs")
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq("id", log.id);
      if (error) {
        console.error("Uncheckin error:", error);
        return null;
      }
    }
    // else: not checked in — idempotent
  }

  return getPracticeStats(practiceId, supabase);
}

/**
 * Compute total_days + consecutive_days for a practice.
 *   total_days: COUNT(*) of non-deleted logs
 *   consecutive_days: starting from today (if checked in) or yesterday, walk backwards
 *                     counting consecutive days with logs
 */
export async function getPracticeStats(
  practiceId: string,
  supabase: SupabaseClient = createClient()
): Promise<PracticeStats> {
  // total_days via count
  const { count } = await supabase
    .from("practice_logs")
    .select("*", { count: "exact", head: true })
    .eq("practice_id", practiceId)
    .eq("is_deleted", false);

  const totalDays = count ?? 0;

  // Fetch all log dates (we need the actual dates to walk consecutive)
  const { data: logs } = await supabase
    .from("practice_logs")
    .select("practiced_at")
    .eq("practice_id", practiceId)
    .eq("is_deleted", false);

  const logDates = new Set((logs ?? []).map((l: { practiced_at: string }) => l.practiced_at));

  // Walk backwards from today (if checked in) or yesterday
  let cursor = todayLocalStr();
  if (!logDates.has(cursor)) {
    cursor = minusOneDay(cursor);
  }
  let consecutive = 0;
  while (logDates.has(cursor)) {
    consecutive++;
    cursor = minusOneDay(cursor);
  }

  return { total_days: totalDays, consecutive_days: consecutive };
}

/**
 * Fetch all checkin dates for a practice in a given month (YYYY-MM).
 * Returns array of YYYY-MM-DD strings.
 * Used by the calendar view to highlight checked-in days.
 */
export async function fetchPracticeLogsByMonth(
  practiceId: string,
  year: number,
  month: number, // 1-12
  supabase: SupabaseClient = createClient()
): Promise<string[]> {
  const padM = String(month).padStart(2, "0");
  const fromStr = `${year}-${padM}-01`;
  // last day of month
  const lastDay = new Date(year, month, 0).getDate();
  const toStr = `${year}-${padM}-${String(lastDay).padStart(2, "0")}`;

  const { data, error } = await supabase
    .from("practice_logs")
    .select("practiced_at")
    .eq("practice_id", practiceId)
    .eq("is_deleted", false)
    .gte("practiced_at", fromStr)
    .lte("practiced_at", toStr);

  if (error) {
    console.error("Fetch practice logs by month error:", error);
    return [];
  }

  return (data ?? []).map((l: { practiced_at: string }) => l.practiced_at);
}

/**
 * Check whether a practice is checked in on a specific date.
 * Used by the today list to split 待完成 vs 已完成.
 */
export async function isCheckedInToday(
  practiceId: string,
  supabase: SupabaseClient = createClient()
): Promise<boolean> {
  const today = todayLocalStr();

  const { count } = await supabase
    .from("practice_logs")
    .select("*", { count: "exact", head: true })
    .eq("practice_id", practiceId)
    .eq("practiced_at", today)
    .eq("is_deleted", false);

  return (count ?? 0) > 0;
}
