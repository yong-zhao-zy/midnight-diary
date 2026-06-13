import { createClient } from "@/lib/supabase/client";
import type { DiaryRow } from "./diary-service";

// --- Interfaces ---

export interface TimelineEntry {
  period: string;
  description: string;
}

export interface DimensionEntry {
  module: string;
  prev_state: string;
  current_shift: string;
}

export interface EventEntry {
  event: string;
  impact: string;
}

export interface TransitionBlock {
  title: string;
  description: string;
}

export interface ReportContent {
  theme: string;
  transition: TransitionBlock | string;
  timeline: TimelineEntry[];
  dimensions: DimensionEntry[];
  events: EventEntry[];
}

export interface ReportRow {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  theme: string;
  content: ReportContent;
  is_public: boolean;
  expert_style: string | null;
  created_at: string;
}

// --- Service Functions ---

/**
 * Fetch all reports for current user, newest first.
 */
export async function fetchReports(): Promise<ReportRow[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Fetch reports error:", error);
    return [];
  }

  return (data ?? []) as ReportRow[];
}

/**
 * Fetch a single report by ID.
 */
export async function getReportById(id: string): Promise<ReportRow | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Get report error:", error);
    return null;
  }

  return data as ReportRow;
}

/**
 * Create a new report.
 */
export async function createReport(
  startDate: string,
  endDate: string,
  content: ReportContent,
  expertStyle?: string
): Promise<ReportRow | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("reports")
    .insert({
      user_id: user.id,
      start_date: startDate,
      end_date: endDate,
      theme: content.theme,
      content,
      expert_style: expertStyle || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Create report error:", error);
    return null;
  }

  return data as ReportRow;
}

/**
 * Update a report's theme (inline rename).
 */
export async function updateReportTheme(
  id: string,
  theme: string
): Promise<boolean> {
  const supabase = createClient();

  const { error } = await supabase
    .from("reports")
    .update({ theme })
    .eq("id", id);

  return !error;
}

/**
 * Update a report's content (for regeneration).
 */
export async function updateReportContent(
  id: string,
  content: ReportContent,
  expertStyle?: string
): Promise<boolean> {
  const supabase = createClient();

  const updatePayload: Record<string, unknown> = { theme: content.theme, content };
  if (expertStyle !== undefined) {
    updatePayload.expert_style = expertStyle;
  }

  const { error } = await supabase
    .from("reports")
    .update(updatePayload)
    .eq("id", id);

  return !error;
}

/**
 * Toggle report public share status.
 */
export async function toggleReportShareStatus(
  id: string,
  isPublic: boolean
): Promise<boolean> {
  const supabase = createClient();

  const { error } = await supabase
    .from("reports")
    .update({ is_public: isPublic })
    .eq("id", id);

  return !error;
}

/**
 * Delete a report.
 */
export async function deleteReport(id: string): Promise<boolean> {
  const supabase = createClient();

  const { error } = await supabase.from("reports").delete().eq("id", id);

  return !error;
}

/**
 * Fetch diaries within a date range for the current user.
 * Uses diary_date field for filtering.
 */
export async function fetchDiariesInRange(
  startDate: string,
  endDate: string
): Promise<DiaryRow[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("diaries")
    .select("*")
    .eq("user_id", user.id)
    .gte("diary_date", startDate)
    .lte("diary_date", endDate)
    .order("diary_date", { ascending: true });

  if (error) {
    console.error("Fetch diaries in range error:", error);
    return [];
  }

  return (data ?? []) as DiaryRow[];
}
