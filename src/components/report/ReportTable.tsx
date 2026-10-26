"use client";

import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { cn } from "@/lib/cn";
import type { DiaryRow } from "@/lib/diary-service";
import { getDiaryDateStr, getDiaryEffectiveDate } from "@/lib/diary-service";
import { type Granularity, formatMMDD } from "@/lib/report-service";
import { type ModuleConfig, LEGACY_KEY_MAP, extractEventText, resolveDotColor } from "@/lib/module-config";
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

const WEEKDAY_LABELS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

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

/** 日 / 月格子：显示格子内每篇日记的模块摘要 */
function DiaryCellContent({
  cell,
  selectedModules,
  moduleConfig,
  dayOverrides,
}: {
  cell: CellData | null;
  selectedModules: string[];
  moduleConfig: ModuleConfig[];
  dayOverrides: Record<string, Record<string, string>>;
}) {
  if (!cell) {
    return <span className="text-muted/40">-</span>;
  }

  const moduleSummaries: { key: string; summary: string }[] = [];
  for (const entry of cell.entries) {
    // 用户编辑过的摘要优先展示
    const dayOverride = dayOverrides[getDiaryDateStr(entry)];
    for (const mod of selectedModules) {
      const overridden = dayOverride?.[mod];
      if (overridden) {
        moduleSummaries.push({ key: mod, summary: overridden });
        continue;
      }
      if (entry.module_summaries) {
        const s = resolveSummaryValue(entry.module_summaries, mod);
        if (s) moduleSummaries.push({ key: mod, summary: extractEventText(s) });
      } else {
        const c = resolveContentValue(entry.content, mod);
        if (c && c.trim()) {
          moduleSummaries.push({ key: mod, summary: c.trim().slice(0, 15) });
        }
      }
    }
  }

  if (moduleSummaries.length === 0) {
    return <span className="text-muted/40">-</span>;
  }

  if (selectedModules.length === 1) {
    return (
      <span className="text-foreground/80 text-xs block overflow-x-auto whitespace-nowrap scrollbar-none cursor-ew-resize active:cursor-grabbing">
        {moduleSummaries.map((m) => m.summary).join(" ")}
      </span>
    );
  }

  const dotColorMap = buildDotColorMap(moduleConfig);

  return (
    <div className="space-y-0.5">
      {moduleSummaries.slice(0, 4).map((m, i) => (
        <div key={`${m.key}-${i}`} className="flex items-center min-w-0">
          <span
            className={cn(
              "inline-block w-1.5 h-1.5 rounded-full mr-2 shrink-0",
              dotColorMap[m.key] || "bg-purple-400"
            )}
          />
          <span className="text-foreground/70 text-[10px] overflow-x-auto whitespace-nowrap scrollbar-none cursor-ew-resize active:cursor-grabbing">
            {m.summary}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * 周期格子（周 / 月）：显示该周期的 AI 摘要（用户编辑过的优先），不按天下钻。
 * 从未生成过 → 显示「N 篇 · 待生成」，点开弹窗即生成（表格渲染不触发 AI）。
 */
function PeriodCellContent({
  scope,
  cell,
  selectedModules,
  moduleConfig,
  aiByModule,
  overrideByModule,
}: {
  scope: PeriodScope;
  cell: CellData | null;
  selectedModules: string[];
  moduleConfig: ModuleConfig[];
  aiByModule?: Record<string, string>;
  overrideByModule?: Record<string, string>;
}) {
  if (!cell || !cell.periodKey) {
    return <span className="text-muted/40">-</span>;
  }

  const lines: { key: string; summary: string; edited: boolean }[] = [];
  for (const mod of selectedModules) {
    const edited = overrideByModule?.[mod];
    const ai = aiByModule?.[mod];
    const text = edited || ai;
    if (text) lines.push({ key: mod, summary: text, edited: !!edited });
  }

  const rangeLine = (
    <div className="text-[10px] text-muted/40 mb-0.5 whitespace-nowrap">
      {periodRangeText(scope, cell.periodKey)}
    </div>
  );

  if (lines.length === 0) {
    return (
      <>
        {rangeLine}
        <span className="text-[10px] text-muted/50 whitespace-nowrap">
          {cell.entries.length} 篇 · 待生成
        </span>
      </>
    );
  }

  if (selectedModules.length === 1) {
    return (
      <>
        {rangeLine}
        <span className="text-foreground/80 text-xs block overflow-x-auto whitespace-nowrap scrollbar-none cursor-ew-resize active:cursor-grabbing">
          {lines[0].summary}
        </span>
      </>
    );
  }

  const dotColorMap = buildDotColorMap(moduleConfig);

  return (
    <>
      {rangeLine}
      <div className="space-y-0.5">
        {lines.slice(0, 4).map((line, i) => (
          <div key={`${line.key}-${i}`} className="flex items-center min-w-0">
            <span
              className={cn(
                "inline-block w-1.5 h-1.5 rounded-full mr-2 shrink-0",
                dotColorMap[line.key] || "bg-purple-400"
              )}
            />
            <span
              className={cn(
                "text-[10px] overflow-x-auto whitespace-nowrap scrollbar-none cursor-ew-resize active:cursor-grabbing",
                line.edited ? "text-glow-gold/85" : "text-foreground/70"
              )}
            >
              {line.summary}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

export function ReportTable({
  diaries,
  granularity,
  selectedModules,
  moduleConfig,
  showHidden,
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

  if (!tableData || tableData.colLabels.length === 0) {
    return (
      <div className="text-center py-12 text-muted/70 text-sm">
        暂无日记数据
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
      <div className="relative overflow-auto rounded-xl border border-white/10">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10">
            <tr>
              {/* Top-left frozen corner */}
              <th className="sticky left-0 z-20 bg-midnight border-b border-r border-white/10 px-3 py-2 text-left text-muted/70 font-medium min-w-[52px]">
                {rowHeaderLabel}
              </th>
              {tableData.colLabels.map((col) => (
                <th
                  key={col}
                  className="bg-midnight border-b border-r border-white/10 px-3 py-2 text-center text-muted/70 font-medium whitespace-nowrap min-w-[120px]"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableData.rowLabels.map((rowLabel, rowIdx) => (
              <tr key={rowLabel}>
                {/* Frozen first column */}
                <td className="sticky left-0 z-10 bg-midnight border-b border-r border-white/10 px-3 py-2 text-muted/70 font-medium whitespace-nowrap">
                  {rowLabel}
                </td>
                {tableData.cells[rowIdx].map((cell, colIdx) => {
                  const periodKey = cell?.periodKey;
                  return (
                    <td
                      key={colIdx}
                      onClick={() => handleCellClick(cell)}
                      className={cn(
                        "border-b border-r border-white/[0.05] px-2 py-1.5 align-top max-w-[220px]",
                        cell && "cursor-pointer hover:bg-white/[0.03] transition-colors"
                      )}
                    >
                      {granularity !== "day" && periodKey ? (
                        <PeriodCellContent
                          scope={granularity}
                          cell={cell}
                          selectedModules={selectedModules}
                          moduleConfig={moduleConfig}
                          aiByModule={aiPeriodByKey[periodSummaryKey(granularity, periodKey)]}
                          overrideByModule={overrideByKey[overrideKey(granularity, periodKey)]}
                        />
                      ) : (
                        <DiaryCellContent
                          cell={cell}
                          selectedModules={selectedModules}
                          moduleConfig={moduleConfig}
                          dayOverrides={dayOverrides}
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
