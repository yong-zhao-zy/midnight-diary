import { createClient } from "@/lib/supabase/client";

// ────── Type Definitions ──────

export interface ActiveEvent {
  event_id: string;
  summary: string;
  key_stakeholders: string;
  status: "ongoing" | "resolved_partially" | "resolved";
  user_cognitive_shift: string;
  created_at: string;
  resolved_at: string | null;
}

export interface MemoryProfile {
  user_id: string;
  updated_at: string;
  mental_baseline: string;
  mental_updated_at: string | null;
  recurring_patterns: string[];
  patterns_updated_at: string | null;
  active_events: ActiveEvent[];
  events_updated_at: string | null;
}

// ────── Browser-side Fetch ──────

/**
 * Fetch current user's memory profile (browser client).
 * Returns null if user is not authenticated or no memory exists.
 */
export async function fetchUserMemory(): Promise<MemoryProfile | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("user_memories")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_deleted", false)
    .single();

  if (error || !data) return null;

  return {
    user_id: data.user_id,
    updated_at: data.updated_at,
    mental_baseline: data.mental_baseline ?? "",
    mental_updated_at: data.mental_updated_at ?? null,
    recurring_patterns: (data.recurring_patterns as string[]) ?? [],
    patterns_updated_at: data.patterns_updated_at ?? null,
    active_events: (data.active_events as ActiveEvent[]) ?? [],
    events_updated_at: data.events_updated_at ?? null,
  };
}
