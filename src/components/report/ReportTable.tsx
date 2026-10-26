"use client";

import { useMemo, useState, type RefObject } from "react";
import { AnimatePresence } from "framer-motion";
import { cn } from "@/lib/cn";
import type { DiaryRow } from "@/lib/diary-service";
import { getDiaryDateStr, getDiaryEffectiveDate } from "@/lib/diary-service";
import { type Granularity, formatMMDD } from "@/lib/report-service";
import {
  type ModuleConfig,
  LEGACY_KEY_MAP,
  extractEventText,
  resolveDotColor,
} from "@/lib/module-config";
import { useSummaryOverrideStore } from "@/store/summary-override-store";
import { usePeriodSummaryStore, periodSummaryKey } from "@/store/period-summary-store";
import { overrideKey } from "@/lib/summary-override-service";
import {
  formatDateKey,
  getPeriodKey,
  getPeriodLabel,
  getPeriodRange,
  parseDateKey,
  type PeriodScope,
} from "@/lib/period-summary-service";
import { DiaryPreviewCard } from "./DiaryPreviewCard";
import { PeriodPreviewCard } from "./PeriodPreviewCard";

interface ReportTableProps {
  diaries: DiaryRow[];
  granularity: Granularity;
  selectedModules: string[];
  moduleConfig: ModuleConfig[];
  showHidden: boolean;
  /** 导出 JPG 时截这一块（含表头与行列标签，不含页面控件） */
  exportRef?: RefObject<HTMLDivElement | null>;
}

interface CellData {
  entries: DiaryRow[];
  /** 该格代表的周期：week = 周一（YYYY-MM-DD）；month = YYYY-MM；day 不用 */
  periodKey?: string;
}

type TableData = {
  rowLabels: string[];
  colLabels: string[];
  /** 每列的周期 key，day/week 表格用作列标识 */
  colKeys: string[];
  cells: (CellData | null)[][];
};

interface PeriodPreviewState {
  scope: PeriodScope;
  periodKey: string;
  entries: DiaryRow[];
  /** 从月弹窗下钻到周时记录来源，用于「返回本月」 */
  returnTo?: { scope: PeriodScope; periodKey: string; entries: DiaryRow[] };
}

/** 格子里的一行摘要（一个维度一条） */
interface CellLine {
  moduleId: string;
  text: string;
  /** 用户手改过 → 用主题色标记 */
  edited: boolean;
}

const WEEKDAY_LABELS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

/** 左侧星期/周次列宽 */
const ROW_HEADER_W = 46;
/**
 * 单列最小宽度：格子太窄摘要会被截成两三个字，宁可横向滚动也要保证可读。
 * 约等于移动端 430 屏（6 列自然周）原先每格宽度的 2 倍。
 */
const COL_MIN_W = 120;


/** 周：10.13–10.19；月：10.01–10.31（格子里的范围提示） */
function periodRangeText(scope: PeriodScope, periodKey: string): string {
  const range = getPeriodRange(scope, periodKey);
  if (!range) return periodKey;
  const md = (key: string) => {
    const d = parseDateKey(key);
    return d ? `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}` : key;
  };
  return `${md(range.start)}–${md(range.end)}`;
}

/**
 * 日模式：把「一周」展开成 7 天。
 * 行 = 周一~周日（固定 7 行），列 = 自然周，格 = 一天。
 * 固定行位保证纵向扫同一行永远是同一个星期（「我每周三怎样」）。
 */
function buildDayTable(diaries: DiaryRow[]): TableData {
  const weekMap = new Map<string, Map<number, DiaryRow[]>>();

  for (const d of diaries) {
    const date = getDiaryEffectiveDate(d);
    const mondayKey = getPeriodKey("week", date);
    const weekday = (date.getDay() + 6) % 7;

    if (!weekMap.has(mondayKey)) weekMap.set(mondayKey, new Map());
    const dayMap = weekMap.get(mondayKey)!;
    if (!dayMap.has(weekday)) dayMap.set(weekday, []);
    dayMap.get(weekday)!.push(d);
  }

  const colKeys = Array.from(weekMap.keys()).sort();
  const colLabels = colKeys.map((key) => {
    const monday = parseDateKey(key);
    if (!monday) return key;
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
    return `${monday.getFullYear()}(${formatMMDD(monday)}–${formatMMDD(sunday)})`;
  });

  const cells: (CellData | null)[][] = [];
  for (let weekday = 0; weekday < 7; weekday++) {
    const row: (CellData | null)[] = [];
    for (const key of colKeys) {
      const entries = weekMap.get(key)!.get(weekday);
      row.push(entries ? { entries, periodKey: key } : null);
    }
    cells.push(row);
  }

  return { rowLabels: WEEKDAY_LABELS, colLabels, colKeys, cells };
}

/**
 * 周模式：把「一个月」展开成自然周。
 * 行 = 月内第 1~N 周，列 = 年月，格 = 一整周（含 7 天日记）。
 *
 * 周归属按月一的月份（自然周不可劈开），这样格 = 1 个 periodKey = 1 份周摘要，
 * 与 period_summaries / summary_overrides 的 key 完全对齐。
 */
function buildWeekTable(diaries: DiaryRow[]): TableData {
  const entriesByWeek = new Map<string, DiaryRow[]>();
  for (const d of diaries) {
    const key = getPeriodKey("week", getDiaryEffectiveDate(d));
    if (!entriesByWeek.has(key)) entriesByWeek.set(key, []);
    entriesByWeek.get(key)!.push(d);
  }

  // 周一所属月 → 该月内的周（升序）
  const weeksByMonth = new Map<string, string[]>();
  for (const key of Array.from(entriesByWeek.keys()).sort()) {
    const monday = parseDateKey(key);
    if (!monday) continue;
    const ym = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}`;
    if (!weeksByMonth.has(ym)) weeksByMonth.set(ym, []);
    weeksByMonth.get(ym)!.push(key);
  }

  const colKeys = Array.from(weeksByMonth.keys()).sort();
  const colLabels = colKeys.map((ym) => {
    const [y, m] = ym.split("-");
    return `${y}年${Number(m)}月`;
  });

  const maxWeeks = Math.max(1, ...colKeys.map((ym) => weeksByMonth.get(ym)!.length));
  const rowLabels = Array.from({ length: maxWeeks }, (_, i) => `第${i + 1}周`);

  const cells: (CellData | null)[][] = [];
  for (let weekIdx = 0; weekIdx < maxWeeks; weekIdx++) {
    const row: (CellData | null)[] = [];
    for (const ym of colKeys) {
      const weekKey = weeksByMonth.get(ym)![weekIdx];
      const entries = weekKey ? entriesByWeek.get(weekKey) : undefined;
      row.push(weekKey && entries ? { entries, periodKey: weekKey } : null);
    }
    cells.push(row);
  }

  return { rowLabels, colLabels, colKeys, cells };
}

/**
 * 月模式：把「一年」展开成 12 个月。
 * 行 = 1~12 月，列 = 年，格 = 一个月。
 */
function buildMonthTable(diaries: DiaryRow[]): TableData {
  const yearMap = new Map<number, Map<number, DiaryRow[]>>();

  for (const d of diaries) {
    const date = getDiaryEffectiveDate(d);
    const year = date.getFullYear();
    const month = date.getMonth();

    if (!yearMap.has(year)) yearMap.set(year, new Map());
    const monthMap = yearMap.get(year)!;
    if (!monthMap.has(month)) monthMap.set(month, []);
    monthMap.get(month)!.push(d);
  }

  const years = Array.from(yearMap.keys()).sort();
  const colLabels = years.map((y) => `${y}年`);
  const rowLabels = Array.from({ length: 12 }, (_, i) => `${i + 1}月`);

  const cells: (CellData | null)[][] = [];
  for (let m = 0; m < 12; m++) {
    const row: (CellData | null)[] = [];
    for (const year of years) {
      const entries = yearMap.get(year)!.get(m);
      row.push(
        entries
          ? { entries, periodKey: `${year}-${String(m + 1).padStart(2, "0")}` }
          : null
      );
    }
    cells.push(row);
  }

  return { rowLabels, colLabels, colKeys: years.map(String), cells };
}

/**
 * Resolve content value for a module ID, handling legacy key fallback.
 */
function resolveContentValue(content: Record<string, string>, moduleId: string): string {
  if (content[moduleId]) return content[moduleId];
  for (const [legacyKey, newId] of Object.entries(LEGACY_KEY_MAP)) {
    if (newId === moduleId && content[legacyKey]) {
      return content[legacyKey];
    }
  }
  return "";
}

/**
 * Resolve summary value for a module ID, handling legacy key fallback.
 */
function resolveSummaryValue(summaries: Record<string, string>, moduleId: string): string {
  if (summaries[moduleId]) return summaries[moduleId];
  for (const [legacyKey, newId] of Object.entries(LEGACY_KEY_MAP)) {
    if (newId === moduleId && summaries[legacyKey]) {
      return summaries[legacyKey];
    }
  }
  return "";
}

function buildDotColorMap(moduleConfig: ModuleConfig[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (let i = 0; i < moduleConfig.length; i++) {
    map[moduleConfig[i].id] = resolveDotColor(moduleConfig[i].id, i);
  }
  return map;
}

/** 日格子：格子内每篇日记、每个维度各出一条摘要（用户手改的优先） */
function dayCellLines(
  cell: CellData,
  selectedModules: string[],
  dayOverrides: Record<string, Record<string, string>>
): CellLine[] {
  const lines: CellLine[] = [];
  for (const entry of cell.entries) {
    const dayOverride = dayOverrides[getDiaryDateStr(entry)];
    for (const mod of selectedModules) {
      const overridden = dayOverride?.[mod];
      if (overridden) {
        lines.push({ moduleId: mod, text: overridden, edited: true });
        continue;
      }
      if (entry.module_summaries) {
        const s = resolveSummaryValue(entry.module_summaries, mod);
        if (s) lines.push({ moduleId: mod, text: extractEventText(s), edited: false });
      } else {
        const c = resolveContentValue(entry.content, mod);
        if (c && c.trim()) {
          lines.push({ moduleId: mod, text: c.trim(), edited: false });
        }
      }
    }
  }
  return lines;
}

/** 周 / 月格子：该周期的 AI 摘要（用户手改的优先），不按天下钻 */
function periodCellLines(
  selectedModules: string[],
  aiByModule?: Record<string, string>,
  overrideByModule?: Record<string, string>
): CellLine[] {
  const lines: CellLine[] = [];
  for (const mod of selectedModules) {
    const edited = overrideByModule?.[mod];
    const ai = aiByModule?.[mod];
    const text = edited || ai;
    if (text) lines.push({ moduleId: mod, text, edited: !!edited });
  }
  return lines;
}

/**
 * 一个矩阵格子 = 棋盘格上的一块底色区域，没有边框、没有圆角、没有卡片。
 * 空白的日子完全留白（不画内容），但底色仍在，保证棋盘连续。
 * 每条摘要前面都有维度圆点——单行也不再漏画。
 */
function MatrixCell({
  lines,
  rangeText,
  pending,
  dotColors,
  onClick,
}: {
  lines: CellLine[];
  rangeText?: string;
  /** 有日记但周期摘要还没生成 → 空心圆点 + 「待生成」 */
  pending?: boolean;
  dotColors: Record<string, string>;
  onClick: () => void;
}) {
  const single = lines.length === 1;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-full min-h-[46px] w-full flex-col items-start px-2.5 py-2 text-left transition-colors hover:bg-accent/[0.07] focus-visible:bg-accent/[0.07] focus-visible:outline-none"
    >
      {rangeText && (
        <span className="mb-1 text-[9.5px] leading-none text-ink-2/35">{rangeText}</span>
      )}

      {pending ? (
        <span className="flex items-center gap-1.5 text-[10.5px] leading-snug text-ink-2/55">
          <span className="h-[5px] w-[5px] shrink-0 rounded-full border border-accent/45" />
          待生成
        </span>
      ) : (
        <div className="w-full space-y-[4px]">
          {lines.slice(0, 3).map((line, i) => (
            <div key={`${line.moduleId}-${i}`} className="flex items-start gap-1.5">
              <span
                className={cn(
                  "mt-[5.5px] h-[5px] w-[5px] shrink-0 rounded-full",
                  dotColors[line.moduleId] || "bg-purple-400"
                )}
              />
              <span
                className={cn(
                  single ? "line-clamp-2" : "line-clamp-1",
                  "text-[11px] leading-snug",
                  line.edited ? "text-accent/85" : "text-ink/80"
                )}
              >
                {line.text}
              </span>
            </div>
          ))}
          {lines.length > 3 && (
            <span className="pl-[11px] text-[9.5px] leading-none text-ink-2/40">
              +{lines.length - 3}
            </span>
          )}
        </div>
      )}
    </button>
  );
}

export function ReportTable({
  diaries,
  granularity,
  selectedModules,
  moduleConfig,
  showHidden,
  exportRef,
}: ReportTableProps) {
  const [preview, setPreview] = useState<DiaryRow | null>(null);
  const [periodPreview, setPeriodPreview] = useState<PeriodPreviewState | null>(null);
  const overrideByKey = useSummaryOverrideStore((s) => s.byKey);
  const aiPeriodByKey = usePeriodSummaryStore((s) => s.byKey);

  // 概览只消费 day scope 的覆盖：{ 'YYYY-MM-DD': { moduleId: content } }
  const dayOverrides = useMemo(() => {
    const map: Record<string, Record<string, string>> = {};
    const prefix = overrideKey("day", "");
    for (const [key, value] of Object.entries(overrideByKey)) {
      if (key.startsWith(prefix)) {
        map[key.slice(prefix.length)] = value;
      }
    }
    return map;
  }, [overrideByKey]);

  const dotColors = useMemo(() => buildDotColorMap(moduleConfig), [moduleConfig]);

  const tableData = useMemo(() => {
    if (diaries.length === 0) return null;
    switch (granularity) {
      case "day":
        return buildDayTable(diaries);
      case "week":
        return buildWeekTable(diaries);
      case "month":
        return buildMonthTable(diaries);
    }
  }, [diaries, granularity]);

  /** 当前周期列（今天所在的那一列）——表头用主题色下划线标出来 */
  const currentColKey = useMemo(() => {
    const now = new Date();
    if (granularity === "day") return getPeriodKey("week", now);
    if (granularity === "week") {
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    }
    return String(now.getFullYear());
  }, [granularity]);

  /** 日模式：今天所在的星期行也标一下 */
  const todayWeekday = useMemo(() => (new Date().getDay() + 6) % 7, []);

  /** 是否存在「有日记但摘要还没生成」的格子（决定要不要显示虚框提示语） */
  const hasPendingCell = useMemo(() => {
    if (!tableData || granularity === "day") return false;
    return tableData.cells.some((row) =>
      row.some((cell) => {
        if (!cell?.periodKey) return false;
        const lines = periodCellLines(
          selectedModules,
          aiPeriodByKey[periodSummaryKey(granularity, cell.periodKey)],
          overrideByKey[overrideKey(granularity, cell.periodKey)]
        );
        return lines.length === 0 && cell.entries.length > 0;
      })
    );
  }, [tableData, granularity, selectedModules, aiPeriodByKey, overrideByKey]);

  if (!tableData || tableData.colLabels.length === 0) {
    return (
      <div className="rounded-2xl border border-line-1 bg-surface-1 px-4 py-10 text-center">
        <p className="text-sm text-ink-2/70">这个范围里还没有日记</p>
        <p className="mt-1 text-[11px] text-ink-2/40">换个日期范围，或者先去写一篇</p>
      </div>
    );
  }

  /**
   * 点击单元格：看到什么就打开什么。
   *   day   → 该日日记弹窗（日摘要可编辑）
   *   week  → 该周的周期弹窗（周摘要可编辑）
   *   month → 该月的周期弹窗（月摘要可编辑，内含该月各周摘要）
   */
  const handleCellClick = (cell: CellData | null) => {
    if (!cell) return;

    if (granularity === "day") {
      if (cell.entries.length === 0) return;
      setPreview(cell.entries[0]);
      return;
    }

    if (!cell.periodKey) return;
    setPeriodPreview({
      scope: granularity,
      periodKey: cell.periodKey,
      entries: cell.entries,
    });
  };

  /** 月弹窗里点某周 → 下钻到该周的周摘要（可返回本月） */
  const handleDrillWeek = (monthKey: string, entries: DiaryRow[], weekKey: string) => {
    const range = getPeriodRange("week", weekKey);
    if (!range) return;
    const weekDates = new Set(range.dates);
    // 周可能跨月：优先从全量日记里取整周，保证弹窗篇数与周摘要口径一致
    const fromAll = diaries.filter((e) =>
      weekDates.has(formatDateKey(getDiaryEffectiveDate(e)))
    );
    const weekEntries =
      fromAll.length > 0
        ? fromAll
        : entries.filter((e) => weekDates.has(formatDateKey(getDiaryEffectiveDate(e))));
    setPeriodPreview({
      scope: "week",
      periodKey: weekKey,
      entries: weekEntries,
      returnTo: { scope: "month", periodKey: monthKey, entries },
    });
  };

  /** 从周弹窗返回所属月 */
  const handleBackToMonth = (returnTo: { periodKey: string; entries: DiaryRow[] }) => {
    setPeriodPreview({
      scope: "month",
      periodKey: returnTo.periodKey,
      entries: returnTo.entries,
    });
  };

  const rowHeaderLabel =
    granularity === "day" ? "星期" : granularity === "week" ? "周次" : "月份";

  return (
    <>
      <div className="-mx-1 overflow-x-auto px-1">
        <div
          ref={exportRef}
          className="w-full bg-page p-2"
          style={{ minWidth: ROW_HEADER_W + tableData.colLabels.length * COL_MIN_W + 16 }}
        >
          <table
            className="w-full table-fixed border-separate border-spacing-0 text-xs"
            style={{ minWidth: ROW_HEADER_W + tableData.colLabels.length * COL_MIN_W }}
          >
          <thead>
            <tr>
              <th className="sticky left-0 z-20 w-[46px] bg-page px-1 pb-2.5 pt-1 text-left text-[10px] font-normal text-ink-2/40">
                {rowHeaderLabel}
              </th>
              {tableData.colLabels.map((col, colIdx) => {
                const isCurrent = tableData.colKeys[colIdx] === currentColKey;
                return (
                  <th
                    key={col}
                    className={cn(
                      "px-1 pb-2.5 pt-1 text-center text-[10px] font-normal whitespace-nowrap",
                      isCurrent ? "text-accent" : "text-ink-2/45"
                    )}
                  >
                    <span className="inline-block">{col}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {tableData.rowLabels.map((rowLabel, rowIdx) => {
              const isTodayRow = granularity === "day" && rowIdx === todayWeekday;
              return (
                <tr key={rowLabel}>
                  <td className="sticky left-0 z-10 h-[46px] w-[46px] bg-page px-1 py-2 align-top">
                    <span
                      className={cn(
                        "text-[10.5px] leading-none",
                        isTodayRow ? "text-accent" : "text-ink-2/45"
                      )}
                    >
                      {rowLabel}
                    </span>
                  </td>
                  {tableData.cells[rowIdx].map((cell, colIdx) => {
                    // 棋盘格：行列都交替，深浅两档同色相底；线一条都不画
                    const stripe = (rowIdx + colIdx) % 2 === 0 ? "bg-stripe-a" : "bg-stripe-b";

                    // 没有记录的日子：底色照旧连成棋盘，但一个字都不写
                    if (!cell) {
                      return (
                        <td
                          key={colIdx}
                          className={cn("h-[46px] align-top", stripe)}
                        />
                      );
                    }

                    const periodKey = cell.periodKey;
                    const lines =
                      granularity !== "day" && periodKey
                        ? periodCellLines(
                            selectedModules,
                            aiPeriodByKey[periodSummaryKey(granularity, periodKey)],
                            overrideByKey[overrideKey(granularity, periodKey)]
                          )
                        : dayCellLines(cell, selectedModules, dayOverrides);

                    const pending =
                      granularity !== "day" && lines.length === 0 && cell.entries.length > 0;

                    return (
                      <td key={colIdx} className={cn("h-[46px] align-top", stripe)}>
                        <MatrixCell
                          lines={lines}
                          rangeText={
                            granularity === "week" && periodKey
                              ? periodRangeText(granularity, periodKey)
                              : undefined
                          }
                          pending={pending}
                          dotColors={dotColors}
                          onClick={() => handleCellClick(cell)}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          </table>
        </div>
      </div>

      <p className="mt-2.5 px-1 text-[10.5px] leading-relaxed text-ink-2/35">
        点格子查看详情
        {hasPendingCell && " · 空心圆点表示这一周期还没生成摘要，点开即生成"}
      </p>

      <AnimatePresence>
        {preview && (
          <DiaryPreviewCard
            entry={preview}
            onClose={() => setPreview(null)}
            moduleConfig={moduleConfig}
            showHidden={showHidden}
          />
        )}
        {periodPreview && (
          <PeriodPreviewCard
            key={`${periodPreview.scope}:${periodPreview.periodKey}`}
            scope={periodPreview.scope}
            periodKey={periodPreview.periodKey}
            entries={periodPreview.entries}
            moduleConfig={moduleConfig}
            showHidden={showHidden}
            onDrillWeek={
              periodPreview.scope === "month"
                ? (weekKey) =>
                    handleDrillWeek(periodPreview.periodKey, periodPreview.entries, weekKey)
                : undefined
            }
            onBack={
              periodPreview.returnTo
                ? () => handleBackToMonth(periodPreview.returnTo!)
                : undefined
            }
            backLabel={
              periodPreview.returnTo
                ? `${getPeriodLabel(periodPreview.returnTo.scope, periodPreview.returnTo.periodKey)}`
                : undefined
            }
            onClose={() => setPeriodPreview(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
