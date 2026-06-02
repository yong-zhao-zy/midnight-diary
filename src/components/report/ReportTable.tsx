"use client";

import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { cn } from "@/lib/cn";
import type { DiaryRow } from "@/lib/diary-service";
import {
  type Granularity,
  getWeekMonday,
  formatMMDD,
} from "@/lib/report-service";
import { type ModuleConfig, LEGACY_KEY_MAP } from "@/lib/module-config";
import { DiaryPreviewCard } from "./DiaryPreviewCard";

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
  cells: (CellData | null)[][];
};

const WEEKDAY_LABELS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

function buildDayTable(diaries: DiaryRow[]): TableData {
  const monthMap = new Map<string, Map<number, DiaryRow[]>>();

  for (const d of diaries) {
    const date = new Date(d.created_at);
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

  return { rowLabels, colLabels, cells };
}

function buildWeekTable(diaries: DiaryRow[]): TableData {
  const weekMap = new Map<string, Map<number, DiaryRow[]>>();

  for (const d of diaries) {
    const date = new Date(d.created_at);
    const monday = getWeekMonday(date);
    const sunday = new Date(monday.getTime() + 6 * 86400000);
    const weekKey = `${monday.getFullYear()}(${formatMMDD(monday)}-${formatMMDD(sunday)})`;
    const weekday = (date.getDay() + 6) % 7;

    if (!weekMap.has(weekKey)) weekMap.set(weekKey, new Map());
    const dayMap = weekMap.get(weekKey)!;
    if (!dayMap.has(weekday)) dayMap.set(weekday, []);
    dayMap.get(weekday)!.push(d);
  }

  const colLabels = Array.from(weekMap.keys());
  const rowLabels = WEEKDAY_LABELS;

  const cells: (CellData | null)[][] = [];
  for (let i = 0; i < 7; i++) {
    const row: (CellData | null)[] = [];
    for (const weekKey of colLabels) {
      const dayMap = weekMap.get(weekKey)!;
      const entries = dayMap.get(i);
      row.push(entries ? { entries } : null);
    }
    cells.push(row);
  }

  return { rowLabels, colLabels, cells };
}

function buildMonthTable(diaries: DiaryRow[]): TableData {
  const yearMap = new Map<number, Map<number, DiaryRow[]>>();

  for (const d of diaries) {
    const date = new Date(d.created_at);
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

  return { rowLabels, colLabels, cells };
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
}: {
  cell: CellData | null;
  selectedModules: string[];
  moduleConfig: ModuleConfig[];
}) {
  if (!cell) {
    return <span className="text-muted/30">-</span>;
  }

  const moduleSummaries: { key: string; summary: string }[] = [];
  for (const entry of cell.entries) {
    if (entry.module_summaries) {
      for (const mod of selectedModules) {
        const s = resolveSummaryValue(entry.module_summaries, mod);
        if (s) moduleSummaries.push({ key: mod, summary: s });
      }
    } else {
      for (const mod of selectedModules) {
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
      <span className="text-foreground/80 text-xs truncate block">
        {moduleSummaries.map((m) => m.summary).join(" ")}
      </span>
    );
  }

  // Build a dotColor lookup from config
  const dotColorMap: Record<string, string> = {};
  for (const m of moduleConfig) {
    dotColorMap[m.id] = m.dotColor;
  }

  return (
    <div className="space-y-0.5">
      {moduleSummaries.slice(0, 4).map((m, i) => (
        <div key={`${m.key}-${i}`} className="flex items-center gap-1 min-w-0">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full shrink-0",
              dotColorMap[m.key] || "bg-gray-400"
            )}
          />
          <span className="text-foreground/70 text-[10px] truncate">
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

  const handleCellClick = (cell: CellData | null) => {
    if (!cell || cell.entries.length === 0) return;
    setPreview(cell.entries[0]);
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
                    onClick={() => handleCellClick(cell)}
                    className={cn(
                      "border-b border-r border-white/[0.05] px-2 py-1.5 align-top max-w-[140px] overflow-hidden",
                      cell && "cursor-pointer hover:bg-white/[0.03] transition-colors"
                    )}
                  >
                    <CellContent
                      cell={cell}
                      selectedModules={selectedModules}
                      moduleConfig={moduleConfig}
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
      </AnimatePresence>
    </>
  );
}
