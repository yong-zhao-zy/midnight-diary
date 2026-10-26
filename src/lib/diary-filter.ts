import type { DateRange } from "react-day-picker";
import { getDiaryDateStr, type DiaryRow } from "@/lib/diary-service";
import { LEGACY_KEY_MAP } from "@/lib/module-config";

/** 本地日期 → YYYY-MM-DD（避免 toISOString 的 UTC 偏移） */
export function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface DiaryFilterState {
  dateRange?: DateRange;
  /** 选中的维度 id 列表；空数组表示「未设置」 */
  modules?: string[];
}

/**
 * 维度筛选是否真的在生效：只有少选了才叫筛选。
 * 全选（= 所有启用维度）等同不过滤，避免列表被误判成「筛选结果」。
 */
export function isModuleFilterActive(
  selected: string[] | undefined,
  activeIds: string[]
): boolean {
  if (!selected || selected.length === 0) return false;
  return selected.length < activeIds.length;
}

/** 单条日记是否命中筛选条件 */
export function matchesDiaryFilter(
  entry: DiaryRow,
  state: DiaryFilterState,
  activeIds: string[]
): boolean {
  const { dateRange, modules } = state;

  if (dateRange?.from) {
    const entryDate = getDiaryDateStr(entry);
    const from = toLocalDateStr(dateRange.from);
    const to = toLocalDateStr(dateRange.to ?? dateRange.from);
    if (entryDate < from || entryDate > to) return false;
  }

  if (isModuleFilterActive(modules, activeIds)) {
    const content = entry.content as Record<string, string>;
    const hit = modules!.some((modId) => {
      const direct = content[modId];
      if (direct && direct.trim()) return true;
      for (const [legacyKey, newId] of Object.entries(LEGACY_KEY_MAP)) {
        if (newId === modId && content[legacyKey]?.trim()) return true;
      }
      return false;
    });
    if (!hit) return false;
  }

  return true;
}

export function filterDiaries(
  entries: DiaryRow[],
  state: DiaryFilterState,
  activeIds: string[]
): DiaryRow[] {
  if (!hasActiveFilter(state, activeIds)) return entries;
  return entries.filter((e) => matchesDiaryFilter(e, state, activeIds));
}

export function hasActiveFilter(
  state: DiaryFilterState,
  activeIds: string[]
): boolean {
  return !!state.dateRange?.from || isModuleFilterActive(state.modules, activeIds);
}
