"use client";

import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { cn } from "@/lib/cn";
import type { DiaryRow } from "@/lib/diary-service";
import {
  type Granularity,
  MODULE_LABELS,
  MODULE_DOT_COLORS,
  getWeekMonday,
  formatMMDD,
} from "@/lib/report-service";
import { DiaryPreviewCard } from "./DiaryPreviewCard";

interface ReportTableProps {
  diaries: DiaryRow[];
  granularity: Granularity;
  selectedModules: string[];
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
  // Group by year-month as columns, day-of-month as rows
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

  // Find min and max day across all data
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
  // Group by week as columns, weekday as rows
  const weekMap = new Map<string, Map<number, DiaryRow[]>>();

  for (const d of diaries) {
    const date = new Date(d.created_at);
    const monday = getWeekMonday(date);
    const sunday = new Date(monday.getTime() + 6 * 86400000);
    const weekKey = `${monday.getFullYear()}(${formatMMDD(monday)}-${formatMMDD(sunday)})`;
    const weekday = (date.getDay() + 6) % 7; // 0=Mon, 6=Sun

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
  // Group by year as columns, month as rows
  const yearMap = new Map<number, Map<number, DiaryRow[]>>();

  for (const d of diaries) {
    const date = new Date(d.created_at);
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-11

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

function CellContent({
  cell,
  selectedModules,
}: {
  cell: CellData | null;
  selectedModules: string[];
}) {
  if (!cell) {
    return <span className="text-muted/30">-</span>;
  }

  // Collect summaries from all entries in this cell
  const moduleSummaries: { key: string; summary: string }[] = [];
  for (const entry of cell.entries) {
    if (entry.module_summaries) {
      for (const mod of selectedModules) {
        const s = entry.module_summaries[mod];
        if (s) moduleSummaries.push({ key: mod, summary: s });
      }
    } else {
      // Fallback: use content truncated
      for (const mod of selectedModules) {
        const c = entry.content[mod];
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

  return (
    <div className="space-y-0.5">
      {moduleSummaries.slice(0, 4).map((m, i) => (
        <div key={`${m.key}-${i}`} className="flex items-center gap-1 min-w-0">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full shrink-0",
              MODULE_DOT_COLORS[m.key]
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
    if (granularity === "month") {
      // For month view, could navigate to list - for now show preview of first entry
      setPreview(cell.entries[0]);
    } else {
      setPreview(cell.entries[0]);
    }
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
                    <CellContent cell={cell} selectedModules={selectedModules} />
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
          />
        )}
      </AnimatePresence>
    </>
  );
}
