import { startOfYear, subDays, startOfMonth } from "date-fns";
import type { DateRange } from "react-day-picker";

/** 当天 0 点（筛选比较一律按天） */
export function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/**
 * 快捷日期范围：写日记页与日记概览共用同一套预设，
 * 避免两处各写一份导致「近 7 天」口径漂移。
 */
export const QUICK_RANGES: { key: string; label: string; build: () => DateRange }[] = [
  {
    key: "today",
    label: "今天",
    build: () => {
      const d = startOfDay(new Date());
      return { from: d, to: d };
    },
  },
  {
    key: "7d",
    label: "近 7 天",
    build: () => ({ from: subDays(startOfDay(new Date()), 6), to: startOfDay(new Date()) }),
  },
  {
    key: "30d",
    label: "近 30 天",
    build: () => ({ from: subDays(startOfDay(new Date()), 29), to: startOfDay(new Date()) }),
  },
  {
    key: "month",
    label: "本月",
    build: () => ({ from: startOfMonth(new Date()), to: startOfDay(new Date()) }),
  },
  {
    key: "year",
    label: "本年",
    build: () => ({ from: startOfYear(new Date()), to: startOfDay(new Date()) }),
  },
];

/** 本年范围（1.1 – 今天）：日记概览的默认展示范围 */
export function buildYearRange(): DateRange {
  return { from: startOfYear(new Date()), to: startOfDay(new Date()) };
}
