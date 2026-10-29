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

/** 单次请求硬超时：跨境链路偶有 10s+ 的 stall，不能让一次尝试无限挂着 */
const REPORT_FETCH_TIMEOUT_MS = 8000;

/**
 * Fetch all diaries with summaries for the current user.
 * Lightweight select: excludes chat_history (not needed for report table).
 */
export async function fetchDiariesForReport(userId: string): Promise<DiaryRow[]> {
  const supabase = createClient();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REPORT_FETCH_TIMEOUT_MS);

  try {
    const { data, error } = await supabase
      .from("diaries")
      .select("id, content, module_summaries, diary_date, created_at, module_labels_snapshot")
      .eq("user_id", userId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: true })
      // postgrest-js 默认自带 3 次内部重试，会和 store 的重试叠加成 4×4=16 个请求、
      // 一次失败要 40 秒才收尾（用户对着骨架屏干等）。重试策略统一交给 store，
      // 这里关掉内部重试：一次尝试失败就快速上抛。
      .retry(false)
      .abortSignal(controller.signal);

    if (error) {
      // 失败必须抛给调用方（store 会重试并在 UI 上提示），
      // 绝不能返回 []——空数组会被当成「用户没有日记」，概览直接显示空态。
      console.error("Fetch diaries for report error:", error);
      throw error;
    }

    return (data ?? []) as DiaryRow[];
  } finally {
    clearTimeout(timer);
  }
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
