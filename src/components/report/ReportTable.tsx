"use client";

import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { cn } from "@/lib/cn";
import type { DiaryRow } from "@/lib/diary-service";
import { getDiaryDateStr, getDiaryEffectiveDate } from "@/lib/diary-service";
import {
  type Granularity,
  formatMMDD,
} from "@/lib/report-service";
import { type ModuleConfig, LEGACY_KEY_MAP, extractEventText, resolveDotColor } from "@/lib/module-config";
import { useSummaryOverrideStore } from "@/store/summary-override-store";
import { overrideKey } from "@/lib/summary-override-service";
import { getPeriodKey, type PeriodScope } from "@/lib/period-summary-service";
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
}

type TableData = {
  rowLabels: string[];
  colLabels: string[];
  /** 每列的周期 key：week = 周一（YYYY-MM-DD）、month = 年（YYYY）、day 未使用 */
  colKeys: string[];
  cells: (CellData | null)[][];
};

interface PeriodPreviewState {
  scope: PeriodScope;
  periodKey: string;
  entries: DiaryRow[];
}

const WEEKDAY_LABELS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

function buildDayTable(diaries: DiaryRow[]): TableData {
  const monthMap = new Map<string, Map<number, DiaryRow[]>>();

  for (const d of diaries) {
    // 按 diary_date 分组（created_at 受触发器保护、改日期后不会同步，不能用来分组）
    const date = getDiaryEffectiveDate(d);
    const monthKey = `${date.getFullYear()}年${date.getMonth() + 1}月`;
    const day = date.getDate();

    if (!monthMap.has(monthKey)) monthMap.set(monthKey, new Map());
    const dayMap = monthMap.get(monthKey)!;
    if (!dayMap.has(day)) dayMap.set(day, []);
    dayMap.get(day)!.push(d);
  }

  const colLabels = Array.from(monthMap.keys());

  let minDay = 31;
  let maxDay = 1;
  for (const dayMap of monthMap.values()) {
    for (const day of dayMap.keys()) {
      if (day < minDay) minDay = day;
      if (day > maxDay) maxDay = day;
    }
  }

  const rowLabels: string[] = [];
  for (let i = minDay; i <= maxDay; i++) {
    rowLabels.push(`${i}日`);
  }

  const cells: (CellData | null)[][] = [];
  for (let i = minDay; i <= maxDay; i++) {
    const row: (CellData | null)[] = [];
    for (const monthKey of colLabels) {
      const dayMap = monthMap.get(monthKey)!;
      const entries = dayMap.get(i);
      row.push(entries ? { entries } : null);
    }
    cells.push(row);
  }

  return { rowLabels, colLabels, colKeys: colLabels, cells };
}

function buildWeekTable(diaries: DiaryRow[]): TableData {
  const weekMap = new Map<string, Map<number, DiaryRow[]>>();

  for (const d of diaries) {
    // 周归属同样以 diary_date 为准
    const date = getDiaryEffectiveDate(d);
    const weekKey = getPeriodKey("week", date);
    const weekday = (date.getDay() + 6) % 7;

    if (!weekMap.has(weekKey)) weekMap.set(weekKey, new Map());
    const dayMap = weekMap.get(weekKey)!;
    if (!dayMap.has(weekday)) dayMap.set(weekday, []);
    dayMap.get(weekday)!.push(d);
  }

  const colKeys = Array.from(weekMap.keys()).sort();
  const colLabels = colKeys.map((key) => {
    const [y, m, day] = key.split("-").map(Number);
    const monday = new Date(y, m - 1, day);
    const sunday = new Date(y, m - 1, day + 6);
    return `${y}(${formatMMDD(monday)}-${formatMMDD(sunday)})`;
  });
  const rowLabels = WEEKDAY_LABELS;

  const cells: (CellData | null)[][] = [];
  for (let i = 0; i < 7; i++) {
    const row: (CellData | null)[] = [];
    for (const weekKey of colKeys) {
      const dayMap = weekMap.get(weekKey)!;
      const entries = dayMap.get(i);
      row.push(entries ? { entries } : null);
    }
    cells.push(row);
  }

  return { rowLabels, colLabels, colKeys, cells };
}

function buildMonthTable(diaries: DiaryRow[]): TableData {
  const yearMap = new Map<number, Map<number, DiaryRow[]>>();

  for (const d of diaries) {
    // 月归属同样以 diary_date 为准
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
      const monthMap = yearMap.get(year)!;
      const entries = monthMap.get(m);
      row.push(entries ? { entries } : null);
    }
    cells.push(row);
  }

  return { rowLabels, colLabels, colKeys: years.map(String), cells };
}

/**
 * Resolve content value for a module ID, handling legacy key fallback.
 */
function resolveContentValue(content: Record<string, string>, moduleId: string): string {
  // Direct match (new keys: m1, m2, m3, m4)
  if (content[moduleId]) return content[moduleId];
  // Legacy fallback: find old key that maps to this module ID
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

function CellContent({
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
    return <span className="text-muted/30">-</span>;
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
    return <span className="text-muted/30">-</span>;
  }

  if (selectedModules.length === 1) {
    return (
      <span className="text-foreground/80 text-xs block overflow-x-auto whitespace-nowrap scrollbar-none cursor-ew-resize active:cursor-grabbing">
        {moduleSummaries.map((m) => m.summary).join(" ")}
      </span>
    );
  }

  // Build a dotColor lookup using resolveDotColor (guaranteed colorful)
  const dotColorMap: Record<string, string> = {};
  for (let i = 0; i < moduleConfig.length; i++) {
    dotColorMap[moduleConfig[i].id] = resolveDotColor(moduleConfig[i].id, i);
  }

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

  // 概览只消费 day scope 的覆盖：{ 'YYYY-MM-DD': { moduleId: content } }
  const dayOverrides = useMemo(() => {
    const map: Record<string, Record<string, string>> = {};
    for (const [key, value] of Object.entries(overrideByKey)) {
      const prefix = overrideKey("day", "");
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
      <div className="text-center py-12 text-muted/60 text-sm">
        暂无日记数据
      </div>
    );
  }

  /**
   * 点击单元格：
   *   day   → 单篇日记弹窗（日摘要可编辑）
   *   week  → 整列（该周 7 天）的周期弹窗，periodKey = 周一
   *   month → 该单元格（一个月）的周期弹窗，periodKey = YYYY-MM
   */
  const handleCellClick = (cell: CellData | null, rowIdx: number, colIdx: number) => {
    if (!tableData) return;

    if (granularity === "day") {
      if (!cell || cell.entries.length === 0) return;
      setPreview(cell.entries[0]);
      return;
    }

    if (granularity === "week") {
      const entries = tableData.cells
        .map((row) => row[colIdx])
        .flatMap((c) => c?.entries ?? []);
      if (entries.length === 0) return;
      setPeriodPreview({
        scope: "week",
        periodKey: tableData.colKeys[colIdx],
        entries,
      });
      return;
    }

    // month：列 = 年，行 = 月
    if (!cell || cell.entries.length === 0) return;
    const year = tableData.colKeys[colIdx];
    const month = String(rowIdx + 1).padStart(2, "0");
    setPeriodPreview({
      scope: "month",
      periodKey: `${year}-${month}`,
      entries: cell.entries,
    });
  };

  return (
    <>
      <div className="relative overflow-auto rounded-xl border border-white/10">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10">
            <tr>
              {/* Top-left frozen corner */}
              <th className="sticky left-0 z-20 bg-midnight border-b border-r border-white/10 px-3 py-2 text-left text-muted/60 font-medium min-w-[52px]">
                {granularity === "day" && "日期"}
                {granularity === "week" && "星期"}
                {granularity === "month" && "月份"}
              </th>
              {tableData.colLabels.map((col) => (
                <th
                  key={col}
                  className="bg-midnight border-b border-r border-white/10 px-3 py-2 text-center text-muted/60 font-medium whitespace-nowrap min-w-[120px]"
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
                <td className="sticky left-0 z-10 bg-midnight border-b border-r border-white/10 px-3 py-2 text-muted/60 font-medium whitespace-nowrap">
                  {rowLabel}
                </td>
                {tableData.cells[rowIdx].map((cell, colIdx) => (
                  <td
                    key={colIdx}
                    onClick={() => handleCellClick(cell, rowIdx, colIdx)}
                    className={cn(
                      "border-b border-r border-white/[0.05] px-2 py-1.5 align-top max-w-[160px]",
                      cell && "cursor-pointer hover:bg-white/[0.03] transition-colors"
                    )}
                  >
                    <CellContent
                      cell={cell}
                      selectedModules={selectedModules}
                      moduleConfig={moduleConfig}
                      dayOverrides={dayOverrides}
                    />
                  </td>
                ))}
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
            onClose={() => setPeriodPreview(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
