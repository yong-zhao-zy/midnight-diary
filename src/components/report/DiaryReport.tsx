"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import type { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { getDiaryDateStr } from "@/lib/diary-service";
import {
  type Granularity,
  loadGranularity,
  saveGranularity,
  loadSelectedModules,
  saveSelectedModules,
} from "@/lib/report-service";
import { getActiveModules, type ModuleConfig } from "@/lib/module-config";
import { filterDiaries } from "@/lib/diary-filter";
import { FilterBar } from "@/components/filters/FilterBar";
import { OverviewStats } from "./OverviewStats";
import { ReportTable } from "./ReportTable";
import { ReportExportButton } from "./ReportExportButton";
import { ReportSkeleton } from "./ReportSkeleton";
import { useDiaryStore } from "@/store/diary-store";
import { useSummaryOverrideStore } from "@/store/summary-override-store";
import { usePeriodSummaryStore } from "@/store/period-summary-store";

interface DiaryReportProps {
  moduleConfig: ModuleConfig[];
}

const GRANULARITY_OPTIONS: { value: Granularity; label: string; hint: string }[] = [
  { value: "day", label: "日", hint: "按星期 × 自然周" },
  { value: "week", label: "周", hint: "按周次 × 月份" },
  { value: "month", label: "月", hint: "按月份 × 年份" },
];

export function DiaryReport({ moduleConfig }: DiaryReportProps) {
  const diaries = useDiaryStore((s) => s.diariesForReport);
  const fetchedAt = useDiaryStore((s) => s.diariesForReportFetchedAt);
  const ensureDiariesForReport = useDiaryStore((s) => s.ensureDiariesForReport);
  const ensureOverrides = useSummaryOverrideStore((s) => s.ensureScope);
  const ensurePeriodSummaries = usePeriodSummaryStore((s) => s.ensureScope);

  const [granularity, setGranularity] = useState<Granularity>(() => loadGranularity());
  const [selectedModules, setSelectedModules] = useState<string[]>(() => {
    const activeIds = getActiveModules(moduleConfig).map((m) => m.id);
    const saved = loadSelectedModules();
    const validSaved = saved.filter((id) => moduleConfig.some((m) => m.id === id));
    return validSaved.length > 0 ? validSaved : activeIds;
  });
  const [showHidden, setShowHidden] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  /** 导出 JPG 时截这块矩阵 */
  const captureRef = useRef<HTMLDivElement>(null);

  const activeModuleIds = useMemo(
    () => getActiveModules(moduleConfig).map((m) => m.id),
    [moduleConfig]
  );

  // Fetch data on mount + when invalidated (fetchedAt → null)
  useEffect(() => {
    if (fetchedAt === null) {
      ensureDiariesForReport();
    }
  }, [fetchedAt, ensureDiariesForReport]);

  // 用户编辑的日摘要（覆盖层）——概览表格与弹窗都优先展示它
  useEffect(() => {
    ensureOverrides("day");
  }, [ensureOverrides]);

  // 周/月模式的格子显示 AI 周期摘要（用户编辑过的优先）：
  // 一次拉全量缓存（不触发生成），生成仍由弹窗按指纹触发
  useEffect(() => {
    if (granularity === "day") return;
    void ensurePeriodSummaries(granularity);
    void ensureOverrides(granularity);
  }, [granularity, ensurePeriodSummaries, ensureOverrides]);

  const handleGranularityChange = (g: Granularity) => {
    setGranularity(g);
    saveGranularity(g);
  };

  const handleModulesChange = (modules: string[]) => {
    setSelectedModules(modules);
    saveSelectedModules(modules);
  };

  // Derive diaryDates for calendar highlighting
  const diaryDates = useMemo(() => diaries.map((d) => getDiaryDateStr(d)), [diaries]);

  /** 导出弹窗里回显的当前范围 */
  const rangeLabel = useMemo(() => {
    if (!dateRange?.from) return "全部日期";
    const from = format(dateRange.from, "MM.dd");
    const to = dateRange.to ? format(dateRange.to, "MM.dd") : from;
    return from === to ? from : `${from}–${to}`;
  }, [dateRange]);

  // 筛选：日期与维度都真正过滤日记。维度既是筛选条件，也决定格子里显示哪些维度。
  const filteredDiaries = useMemo(
    () =>
      filterDiaries(diaries, { dateRange, modules: selectedModules }, activeModuleIds),
    [diaries, dateRange, selectedModules, activeModuleIds]
  );

  // Skeleton only on first load (data never fetched); keep stale data visible during re-fetch
  if (fetchedAt === null && diaries.length === 0) {
    return <ReportSkeleton />;
  }

  return (
    <div>
      {/* 同一条筛选框（写日记 / 概览 / 报告三页一致），右侧是本页独有的粒度与导出 */}
      <FilterBar
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        selectedModules={selectedModules}
        onModulesChange={handleModulesChange}
        moduleConfig={moduleConfig}
        activeModuleIds={activeModuleIds}
        showHidden={showHidden}
        onShowHiddenChange={setShowHidden}
        diaryDates={diaryDates}
        entries={diaries}
        dateAction={(n) => `查看 ${n} 篇`}
        moduleAction={(n) => `显示 ${n} 篇`}
        action={
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-0.5 rounded-full bg-surface-2 p-0.5">
              {GRANULARITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleGranularityChange(opt.value)}
                  title={opt.hint}
                  aria-pressed={granularity === opt.value}
                  className={
                    granularity === opt.value
                      ? "h-6 rounded-full bg-accent px-2 text-[11px] text-accent-ink"
                      : "h-6 rounded-full px-2 text-[11px] text-ink-2/60 transition-colors hover:text-ink"
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <ReportExportButton
              entries={filteredDiaries}
              moduleConfig={moduleConfig}
              moduleIds={selectedModules}
              granularity={granularity}
              rangeLabel={rangeLabel}
              captureRef={captureRef}
            />
          </div>
        }
      />

      {/* 摘要条：跟着筛选结果走，先看数再看矩阵 */}
      <OverviewStats entries={filteredDiaries} granularity={granularity} />

      <ReportTable
        diaries={filteredDiaries}
        granularity={granularity}
        selectedModules={selectedModules}
        moduleConfig={moduleConfig}
        showHidden={showHidden}
        exportRef={captureRef}
      />
    </div>
  );
}
