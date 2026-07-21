import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

export type NoteSourceType = "ai_interpretation" | "manual";

export interface NoteRow {
  id: string;
  user_id: string;
  content: string;
  source_type: NoteSourceType;
  source_diary_id: string | null;
  source_diary_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateNoteInput {
  userId: string;
  content: string;
  source_type: NoteSourceType;
  source_diary_id?: string;
}

/**
 * Fetch all notes for a user, newest first.
 * Lightweight select — no heavy JSON columns on this table.
 */
export async function fetchNotes(
  userId: string,
  supabase: SupabaseClient = createClient()
): Promise<NoteRow[]> {
  const { data, error } = await supabase
    .from("notes")
    .select("id, user_id, content, source_type, source_diary_id, source_diary_date, created_at, updated_at")
    .eq("user_id", userId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Fetch notes error:", error);
    return [];
  }

  return (data ?? []) as NoteRow[];
}

/**
 * Create a new note.
 * If source_diary_id is provided, looks up the diary to:
 *   1. Verify ownership (diaries.user_id === userId)
 *   2. Read diary_date and denormalize into source_diary_date for list display
 * Returns null on failure.
 */
export async function createNote(
  input: CreateNoteInput,
  supabase: SupabaseClient = createClient()
): Promise<NoteRow | null> {

  const insertPayload: Record<string, unknown> = {
    user_id: input.userId,
    content: input.content,
    source_type: input.source_type,
  };

  if (input.source_diary_id) {
    // Verify ownership + read diary_date
    const { data: diary, error: diaryErr } = await supabase
      .from("diaries")
      .select("user_id, diary_date")
      .eq("id", input.source_diary_id)
      .eq("is_deleted", false)
      .single();

    if (diaryErr || !diary) {
      console.error("Create note: source diary not found or not owned:", diaryErr);
      return null;
    }
    if (diary.user_id !== input.userId) {
      console.error("Create note: source diary not owned by user");
      return null;
    }

    insertPayload.source_diary_id = input.source_diary_id;
    insertPayload.source_diary_date = diary.diary_date || null;
  }

  const { data, error } = await supabase
    .from("notes")
    .insert(insertPayload)
    .select("id, user_id, content, source_type, source_diary_id, source_diary_date, created_at, updated_at")
    .single();

  if (error || !data) {
    console.error("Create note error:", error);
    return null;
  }

  return data as NoteRow;
}

/**
 * Update note content (overwrite — Q3 confirmed).
 */
export async function updateNoteContent(
  id: string,
  content: string,
  supabase: SupabaseClient = createClient()
): Promise<NoteRow | null> {
  const { data, error } = await supabase
    .from("notes")
    .update({ content, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("is_deleted", false)
    .select("id, user_id, content, source_type, source_diary_id, source_diary_date, created_at, updated_at")
    .single();

  if (error || !data) {
    console.error("Update note error:", error);
    return null;
  }

  return data as NoteRow;
}

/**
 * Soft-delete a note.
 */
export async function softDeleteNote(
  id: string,
  supabase: SupabaseClient = createClient()
): Promise<boolean> {
  const { error } = await supabase
    .from("notes")
    .update({ is_deleted: true, deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("is_deleted", false);

  if (error) {
    console.error("Soft-delete note error:", error);
    return false;
  }

  return true;
}
