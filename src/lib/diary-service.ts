import { createClient } from "@/lib/supabase/client";

export interface ChatMessage {
  type: "reference" | "user" | "ai";
  label: string;
  content: string;
}

export interface DiaryContent {
  [key: string]: string;
}

export interface DiaryRow {
  id: string;
  user_id: string;
  content: DiaryContent;
  chat_history: ChatMessage[];
  module_summaries?: Record<string, string> | null;
  module_labels_snapshot?: Record<string, string> | null;
  created_at: string;
}

/**
 * Find today's existing diary for the current user.
 * Shared helper to avoid duplicate queries.
 */
async function findTodayDiaryId(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<string | null> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

  const { data } = await supabase
    .from("diaries")
    .select("id")
    .eq("user_id", userId)
    .gte("created_at", startOfDay)
    .lt("created_at", endOfDay)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  return data?.id ?? null;
}

/**
 * Fetch existing content for today's diary to support deep merge.
 */
async function fetchTodayContent(
  supabase: ReturnType<typeof createClient>,
  diaryId: string
): Promise<Record<string, string>> {
  const { data } = await supabase
    .from("diaries")
    .select("content")
    .eq("id", diaryId)
    .single();

  return (data?.content as Record<string, string>) || {};
}

/**
 * Deep merge: existing content + new content.
 * New non-empty values override; existing values are preserved if new value is empty/missing.
 */
function deepMergeContent(
  existing: Record<string, string>,
  incoming: Record<string, string>
): Record<string, string> {
  const merged = { ...existing };
  for (const [key, value] of Object.entries(incoming)) {
    if (value && value.trim()) {
      merged[key] = value;
    }
  }
  return merged;
}

/**
 * Upsert a draft to Supabase (no chat_history yet).
 * Uses deep merge to prevent overwriting existing content from other modules.
 */
export async function upsertDraftToCloud(
  content: Record<string, string>,
  labelsSnapshot?: Record<string, string>
): Promise<string | null> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const existingId = await findTodayDiaryId(supabase, user.id);

  if (existingId) {
    // Deep merge: fetch existing, merge with incoming
    const existingContent = await fetchTodayContent(supabase, existingId);
    const mergedContent = deepMergeContent(existingContent, content);

    const updatePayload: Record<string, unknown> = { content: mergedContent };
    if (labelsSnapshot) {
      updatePayload.module_labels_snapshot = labelsSnapshot;
    }

    await supabase.from("diaries").update(updatePayload).eq("id", existingId);
    return existingId;
  }

  // Insert new row — use diary_date for future upsert safety
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const insertPayload: Record<string, unknown> = {
    user_id: user.id,
    diary_date: today,
    content,
    chat_history: [{ type: "reference", label: "日记原文", content: "" }],
  };
  if (labelsSnapshot) {
    insertPayload.module_labels_snapshot = labelsSnapshot;
  }

  const { data: inserted } = await supabase
    .from("diaries")
    .insert(insertPayload)
    .select("id")
    .single();

  return inserted?.id ?? null;
}

/**
 * Save diary to Supabase diaries table.
 * Uses deep merge + upsert logic: if today's diary exists, merge & UPDATE; otherwise INSERT.
 */
export async function saveDiaryToCloud(
  content: Record<string, string>,
  aiResponse: string,
  labelsSnapshot?: Record<string, string>
): Promise<DiaryRow | null> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const chatHistory: ChatMessage[] = [
    { type: "reference", label: "日记原文", content: "" },
  ];

  if (aiResponse) {
    chatHistory.push({ type: "ai", label: "初次回响", content: aiResponse });
  }

  const existingId = await findTodayDiaryId(supabase, user.id);

  if (existingId) {
    // Deep merge content
    const existingContent = await fetchTodayContent(supabase, existingId);
    const mergedContent = deepMergeContent(existingContent, content);

    const updatePayload: Record<string, unknown> = {
      content: mergedContent,
      chat_history: chatHistory,
    };
    if (labelsSnapshot) {
      updatePayload.module_labels_snapshot = labelsSnapshot;
    }

    const { data, error } = await supabase
      .from("diaries")
      .update(updatePayload)
      .eq("id", existingId)
      .select()
      .single();

    if (error) {
      console.error("Update diary error:", error);
      return null;
    }
    return data as DiaryRow;
  }

  // Insert new diary
  const today = new Date().toISOString().slice(0, 10);
  const insertPayload: Record<string, unknown> = {
    user_id: user.id,
    diary_date: today,
    content,
    chat_history: chatHistory,
  };
  if (labelsSnapshot) {
    insertPayload.module_labels_snapshot = labelsSnapshot;
  }

  const { data, error } = await supabase
    .from("diaries")
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    console.error("Save diary error:", error);
    return null;
  }

  return data as DiaryRow;
}

/**
 * Get exact count of diaries for current user.
 */
export async function getDiaryCount(): Promise<number> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return 0;

  const { count } = await supabase
    .from("diaries")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  return count ?? 0;
}

/**
 * Fetch all diaries for current user, newest first.
 */
export async function fetchDiaries(): Promise<DiaryRow[]> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("diaries")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Fetch diaries error:", error);
    return [];
  }

  return (data ?? []) as DiaryRow[];
}

/**
 * Fetch all distinct diary_date values for the current user.
 * Lightweight query — only selects the date field.
 */
export async function fetchDiaryDates(): Promise<string[]> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("diaries")
    .select("diary_date")
    .eq("user_id", user.id);

  if (error) {
    console.error("Fetch diary dates error:", error);
    return [];
  }

  // Deduplicate and filter nulls
  const dates = new Set<string>();
  for (const row of data ?? []) {
    if (row.diary_date) dates.add(row.diary_date);
  }
  return Array.from(dates);
}

/**
 * Check if user already has a diary entry for today (local date).
 * Returns the diary row if found, null otherwise.
 */
export async function getTodayDiary(): Promise<DiaryRow | null> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Use local date boundaries
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

  const { data } = await supabase
    .from("diaries")
    .select("*")
    .eq("user_id", user.id)
    .gte("created_at", startOfDay)
    .lt("created_at", endOfDay)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return (data as DiaryRow) || null;
}

/**
 * Fetch a single diary by ID.
 */
export async function getDiaryById(id: string): Promise<DiaryRow | null> {
  const supabase = createClient();

  const { data } = await supabase
    .from("diaries")
    .select("*")
    .eq("id", id)
    .single();

  return (data as DiaryRow) || null;
}

/**
 * Append a follow-up exchange to chat_history.
 */
export async function appendChatHistory(
  diaryId: string,
  question: string,
  answer: string
): Promise<boolean> {
  const supabase = createClient();

  const { data: existing } = await supabase
    .from("diaries")
    .select("chat_history")
    .eq("id", diaryId)
    .single();

  if (!existing) return false;

  const history = existing.chat_history as ChatMessage[];
  history.push(
    { type: "user", label: "追问", content: question },
    { type: "ai", label: "回响", content: answer }
  );

  const { error } = await supabase
    .from("diaries")
    .update({ chat_history: history })
    .eq("id", diaryId);

  return !error;
}

/**
 * Update diary content (for re-edit). Uses deep merge.
 */
export async function updateDiaryContent(
  diaryId: string,
  content: Record<string, string>,
  labelsSnapshot?: Record<string, string>
): Promise<boolean> {
  const supabase = createClient();

  // Fetch existing content and merge
  const { data: existing } = await supabase
    .from("diaries")
    .select("content")
    .eq("id", diaryId)
    .single();

  const existingContent = (existing?.content as Record<string, string>) || {};
  const mergedContent = deepMergeContent(existingContent, content);

  const updatePayload: Record<string, unknown> = { content: mergedContent };
  if (labelsSnapshot) {
    updatePayload.module_labels_snapshot = labelsSnapshot;
  }

  const { error } = await supabase
    .from("diaries")
    .update(updatePayload)
    .eq("id", diaryId);

  return !error;
}

/**
 * Replace chat_history with a fresh reinterpretation.
 */
export async function resetChatHistory(
  diaryId: string,
  newAiResponse: string
): Promise<boolean> {
  const supabase = createClient();

  const newHistory: ChatMessage[] = [
    { type: "reference", label: "日记原文", content: "" },
    { type: "ai", label: "重新解读", content: newAiResponse },
  ];

  const { error } = await supabase
    .from("diaries")
    .update({ chat_history: newHistory })
    .eq("id", diaryId);

  return !error;
}
