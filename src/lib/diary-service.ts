import { createClient } from "@/lib/supabase/client";

export interface ChatMessage {
  type: "reference" | "user" | "ai";
  label: string;
  content: string;
}

export interface DiaryRow {
  id: string;
  user_id: string;
  content: Record<string, string>;
  chat_history: ChatMessage[];
  created_at: string;
}

/**
 * Save diary to Supabase diaries table.
 * content: { "emotion": "...", "body": "...", ... }
 * chat_history: [{ type, label, content }, ...]
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

  const { data, error } = await supabase
    .from("diaries")
    .insert({
      user_id: user.id,
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
