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
import { DateRangePicker } from "@/components/diary/DateRangePicker";
import { ModuleFilter } from "@/components/diary/ModuleFilter";
import { ReportFilters } from "./ReportFilters";
import { ReportTable } from "./ReportTable";
import { ReportSkeleton } from "./ReportSkeleton";
import { useDiaryStore } from "@/store/diary-store";

interface DiaryReportProps {
  moduleConfig: ModuleConfig[];
}

export function DiaryReport({ moduleConfig }: DiaryReportProps) {
  const diaries = useDiaryStore((s) => s.diariesForReport);
  const fetchedAt = useDiaryStore((s) => s.diariesForReportFetchedAt);
  const ensureDiariesForReport = useDiaryStore((s) => s.ensureDiariesForReport);

  const [granularity, setGranularity] = useState<Granularity>(() => loadGranularity());
  const [selectedModules, setSelectedModules] = useState<string[]>(() => {
    const activeIds = getActiveModules(moduleConfig).map((m) => m.id);
    const saved = loadSelectedModules();
    const validSaved = saved.filter((id) => moduleConfig.some((m) => m.id === id));
    return validSaved.length > 0 ? validSaved : activeIds;
  });
  const [showHidden, setShowHidden] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  // Fetch data on mount + when invalidated (fetchedAt → null)
  useEffect(() => {
    if (fetchedAt === null) {
      ensureDiariesForReport();
    }
  }, [fetchedAt, ensureDiariesForReport]);

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
    <div className="space-y-4">
      <DateRangePicker
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        highlightDates={diaryDates}
      />

      <ModuleFilter
        moduleConfig={moduleConfig}
        selectedModules={selectedModules}
        onModulesChange={handleModulesChange}
        showHidden={showHidden}
        onShowHiddenChange={setShowHidden}
      />

      <ReportFilters
        granularity={granularity}
        onGranularityChange={handleGranularityChange}
      />

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
