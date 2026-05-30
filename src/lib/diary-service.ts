import { createClient } from "@/lib/supabase/client";

export interface ChatMessage {
  type: "reference" | "user" | "ai";
  label: string;
  content: string;
}

export interface DiaryContent {
  mind_body: string;
  connection: string;
  peak_moment: string;
  vision: string;
  [key: string]: string; // allow iteration
}

export interface DiaryRow {
  id: string;
  user_id: string;
  content: DiaryContent;
  chat_history: ChatMessage[];
  module_summaries?: Record<string, string> | null;
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
 * Upsert a draft to Supabase (no chat_history yet).
 * Uses today's date boundary to find/update existing row.
 */
export async function upsertDraftToCloud(
  content: Record<string, string>
): Promise<string | null> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const existingId = await findTodayDiaryId(supabase, user.id);

  if (existingId) {
    await supabase.from("diaries").update({ content }).eq("id", existingId);
    return existingId;
  }

  // Insert new row — use diary_date for future upsert safety
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const { data: inserted } = await supabase
    .from("diaries")
    .insert({
      user_id: user.id,
      diary_date: today,
      content,
      chat_history: [{ type: "reference", label: "日记原文", content: "" }],
    })
    .select("id")
    .single();

  return inserted?.id ?? null;
}

/**
 * Save diary to Supabase diaries table.
 * Uses upsert logic: if today's diary exists, UPDATE it; otherwise INSERT.
 */
export async function saveDiaryToCloud(
  content: Record<string, string>,
  aiResponse: string
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
    // Update existing diary with content and chat_history
    const { data, error } = await supabase
      .from("diaries")
      .update({ content, chat_history: chatHistory })
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
  const { data, error } = await supabase
    .from("diaries")
    .insert({
      user_id: user.id,
      diary_date: today,
      content,
      chat_history: chatHistory,
    })
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
 * Update diary content (for re-edit).
 */
export async function updateDiaryContent(
  diaryId: string,
  content: Record<string, string>
): Promise<boolean> {
  const supabase = createClient();

  const { error } = await supabase
    .from("diaries")
    .update({ content })
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
