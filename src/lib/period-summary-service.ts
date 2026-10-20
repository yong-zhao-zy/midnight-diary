/**
 * 周期（周/月）摘要的纯工具函数 —— 客户端与服务端共用，不含任何 IO。
 *
 * 约定（2026-10-20 产品决策）：
 *   - 周摘要 period_key = 该周周一的 'YYYY-MM-DD'（本地时区，周一起算）
 *   - 月摘要 period_key = 'YYYY-MM'
 *   - 周摘要承接日摘要做提炼；月摘要承接周摘要做提炼
 *   - 用户编辑的周期摘要存在 summary_overrides，AI 生成的存 period_summaries
 */

export type PeriodScope = "week" | "month";

export const PERIOD_SCOPES: PeriodScope[] = ["week", "month"];

export const PERIOD_SCOPE_LABEL: Record<PeriodScope, string> = {
  week: "本周",
  month: "本月",
};

export const WEEKDAY_NAMES = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

/** yyyy-mm-dd（本地时区，不经过 UTC 转换） */
export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 解析 yyyy-mm-dd 为本地零点的 Date；非法返回 null */
export function parseDateKey(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  if (
    date.getFullYear() !== Number(y) ||
    date.getMonth() !== Number(m) - 1 ||
    date.getDate() !== Number(d)
  ) {
    return null;
  }
  return date;
}

/** 该日期所在周的周一（本地零点） */
export function getWeekMonday(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

/** 日期 → 周期 key */
export function getPeriodKey(scope: PeriodScope, date: Date): string {
  if (scope === "month") {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }
  return formatDateKey(getWeekMonday(date));
}

export interface PeriodRange {
  /** 起始日（含），yyyy-mm-dd */
  start: string;
  /** 结束日（含），yyyy-mm-dd */
  end: string;
  /** 周期内每一天，yyyy-mm-dd */
  dates: string[];
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + days);
  return d;
}

/** period key → 日期区间；非法 key 返回 null */
export function getPeriodRange(scope: PeriodScope, periodKey: string): PeriodRange | null {
  if (scope === "week") {
    const monday = parseDateKey(periodKey);
    if (!monday) return null;
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) dates.push(formatDateKey(addDays(monday, i)));
    return { start: dates[0], end: dates[6], dates };
  }

  const match = /^(\d{4})-(\d{2})$/.exec(periodKey);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  const daysInMonth = new Date(year, month, 0).getDate();
  const dates: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    dates.push(`${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  return { start: dates[0], end: dates[dates.length - 1], dates };
}

/** 周：'10月14日 - 10月20日'；月：'2026年10月' */
export function getPeriodLabel(scope: PeriodScope, periodKey: string): string {
  const range = getPeriodRange(scope, periodKey);
  if (!range) return periodKey;

  if (scope === "month") {
    const [y, m] = periodKey.split("-");
    return `${y}年${Number(m)}月`;
  }

  const start = parseDateKey(range.start)!;
  const end = parseDateKey(range.end)!;
  const startText = `${start.getMonth() + 1}月${start.getDate()}日`;
  const endText =
    start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()
      ? `${end.getDate()}日`
      : `${end.getMonth() + 1}月${end.getDate()}日`;
  return `${startText} - ${endText}`;
}

/** 'MM-DD'，用于周期弹窗里的日摘要前缀 */
export function formatMonthDay(dateKey: string): string {
  const date = parseDateKey(dateKey);
  if (!date) return dateKey;
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
