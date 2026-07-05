"use client";

import { useEffect, useState, useMemo } from "react";
import { Loader2 } from "lucide-react";
import type { DateRange } from "react-day-picker";
import type { DiaryRow } from "@/lib/diary-service";
import { getDiaryDateStr } from "@/lib/diary-service";
import {
  type Granularity,
  fetchDiariesForReport,
  loadGranularity,
  saveGranularity,
  loadSelectedModules,
  saveSelectedModules,
} from "@/lib/report-service";
import { getActiveModules, type ModuleConfig } from "@/lib/module-config";
import { createClient } from "@/lib/supabase/client";
import { DateRangePicker } from "@/components/diary/DateRangePicker";
import { ModuleFilter } from "@/components/diary/ModuleFilter";
import { ReportFilters } from "./ReportFilters";
import { ReportTable } from "./ReportTable";

interface DiaryReportProps {
  moduleConfig: ModuleConfig[];
}

export function DiaryReport({ moduleConfig }: DiaryReportProps) {
  const [diaries, setDiaries] = useState<DiaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [granularity, setGranularity] = useState<Granularity>("week");
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [showHidden, setShowHidden] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Initialize selectedModules from user's config or localStorage
      const activeIds = getActiveModules(moduleConfig).map((m) => m.id);
      const saved = loadSelectedModules();
      const validSaved = saved.filter((id) => moduleConfig.some((m) => m.id === id));
      setSelectedModules(validSaved.length > 0 ? validSaved : activeIds);

      setGranularity(loadGranularity());

      if (user) {
        const data = await fetchDiariesForReport(user.id);
        setDiaries(data);
      }
      setLoading(false);
    }

    init();
  }, [moduleConfig]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-glow-gold/60" />
      </div>
    );
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
