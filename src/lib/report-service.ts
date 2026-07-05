import { createClient } from "@/lib/supabase/client";
import type { DiaryRow } from "@/lib/diary-service";
import {
  DEFAULT_MODULE_CONFIG,
  getActiveModules,
  getModuleLabels,
  getModuleColors,
  getModuleDotColors,
} from "@/lib/module-config";

export type Granularity = "day" | "week" | "month";

const activeModules = getActiveModules(DEFAULT_MODULE_CONFIG);

export const MODULE_KEYS = activeModules.map((m) => m.id);

export const MODULE_LABELS: Record<string, string> = getModuleLabels(DEFAULT_MODULE_CONFIG);

export const MODULE_COLORS: Record<string, string> = getModuleColors(DEFAULT_MODULE_CONFIG);

export const MODULE_DOT_COLORS: Record<string, string> = getModuleDotColors(DEFAULT_MODULE_CONFIG);

/**
 * Fetch all diaries with summaries for the current user.
 * Lightweight select: excludes chat_history (not needed for report table).
 */
export async function fetchDiariesForReport(userId: string): Promise<DiaryRow[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("diaries")
    .select("id, content, module_summaries, diary_date, created_at, module_labels_snapshot")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Fetch diaries for report error:", error);
    return [];
  }

  return (data ?? []) as DiaryRow[];
}

/**
 * Get the ISO week number for a date.
 */
export function getISOWeek(date: Date): number {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
  );
}

/**
 * Get Monday of the week for a given date.
 */
export function getWeekMonday(date: Date): Date {
  const d = new Date(date.getTime());
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Format date as MM/DD
 */
export function formatMMDD(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${m}${d}`;
}

// ─── LocalStorage helpers ─────────────────────────────────────────────────────

const STORAGE_KEY_GRANULARITY = "report_granularity";
const STORAGE_KEY_MODULES = "report_modules";

export function loadGranularity(): Granularity {
  if (typeof window === "undefined") return "week";
  const saved = localStorage.getItem(STORAGE_KEY_GRANULARITY);
  if (saved === "day" || saved === "week" || saved === "month") return saved;
  return "week";
}

export function saveGranularity(g: Granularity): void {
  localStorage.setItem(STORAGE_KEY_GRANULARITY, g);
}

export function loadSelectedModules(): string[] {
  if (typeof window === "undefined") return [...MODULE_KEYS];
  const saved = localStorage.getItem(STORAGE_KEY_MODULES);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      // fallback
    }
  }
  return [...MODULE_KEYS];
}

export function saveSelectedModules(modules: string[]): void {
  localStorage.setItem(STORAGE_KEY_MODULES, JSON.stringify(modules));
}
