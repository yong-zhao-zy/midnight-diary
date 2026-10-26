"use client";

import { useEffect, useState, useMemo } from "react";
import type { DateRange } from "react-day-picker";
import { getDiaryDateStr } from "@/lib/diary-service";
import {
  type Granularity,
  loadGranularity,
  saveGranularity,
  loadSelectedModules,
  saveSelectedModules,
} from "@/lib/report-service";
import { getActiveModules, type ModuleConfig } from "@/lib/module-config";
import { ReportControls } from "./ReportControls";
import { OverviewStats } from "./OverviewStats";
import { ReportTable } from "./ReportTable";
import { ReportSkeleton } from "./ReportSkeleton";
import { useDiaryStore } from "@/store/diary-store";
import { useSummaryOverrideStore } from "@/store/summary-override-store";
import { usePeriodSummaryStore } from "@/store/period-summary-store";

interface DiaryReportProps {
  moduleConfig: ModuleConfig[];
}

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

  // Filter diaries by date range
  const filteredDiaries = useMemo(() => {
    if (!dateRange?.from) return diaries;
    const fromStr = `${dateRange.from.getFullYear()}-${String(dateRange.from.getMonth() + 1).padStart(2, "0")}-${String(dateRange.from.getDate()).padStart(2, "0")}`;
    const toDate = dateRange.to ?? dateRange.from;
    const toStr = `${toDate.getFullYear()}-${String(toDate.getMonth() + 1).padStart(2, "0")}-${String(toDate.getDate()).padStart(2, "0")}`;
    return diaries.filter((d) => {
      const dStr = getDiaryDateStr(d);
      return dStr >= fromStr && dStr <= toStr;
    });
  }, [diaries, dateRange]);

  // Skeleton only on first load (data never fetched); keep stale data visible during re-fetch
  if (fetchedAt === null && diaries.length === 0) {
    return <ReportSkeleton />;
  }

  return (
    <div>
      {/* 一行控制层：日期 / 维度 / 粒度（原来是 4 层，占掉小半屏） */}
      <ReportControls
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        selectedModules={selectedModules}
        onModulesChange={handleModulesChange}
        moduleConfig={moduleConfig}
        activeModuleIds={activeModuleIds}
        showHidden={showHidden}
        onShowHiddenChange={setShowHidden}
        diaryDates={diaryDates}
        granularity={granularity}
        onGranularityChange={handleGranularityChange}
        entries={diaries}
      />

      {/* 摘要条：跟着筛选结果走，先看数再看矩阵 */}
      <OverviewStats entries={filteredDiaries} granularity={granularity} />

      <ReportTable
        diaries={filteredDiaries}
        granularity={granularity}
        selectedModules={selectedModules}
        moduleConfig={moduleConfig}
        showHidden={showHidden}
      />
    </div>
  );
}
