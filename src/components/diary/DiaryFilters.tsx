"use client";

import { type ReactNode } from "react";
import { type DateRange } from "react-day-picker";
import { type ModuleConfig } from "@/lib/module-config";
import { DateRangePicker } from "./DateRangePicker";
import { ModuleFilter } from "./ModuleFilter";

export type { DateRange } from "react-day-picker";

interface DiaryFiltersProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  selectedModules: string[];
  onModulesChange: (ids: string[]) => void;
  moduleConfig: ModuleConfig[];
  showHidden: boolean;
  onShowHiddenChange: (show: boolean) => void;
  diaryDates: string[];
  actionSlot?: ReactNode;
}

export function DiaryFilters({
  dateRange,
  onDateRangeChange,
  selectedModules,
  onModulesChange,
  moduleConfig,
  showHidden,
  onShowHiddenChange,
  diaryDates,
  actionSlot,
}: DiaryFiltersProps) {
  return (
    <div className="space-y-3 mb-5">
      <DateRangePicker
        dateRange={dateRange}
        onDateRangeChange={onDateRangeChange}
        highlightDates={diaryDates}
        trailingActions={actionSlot}
      />

      <ModuleFilter
        moduleConfig={moduleConfig}
        selectedModules={selectedModules}
        onModulesChange={onModulesChange}
        showHidden={showHidden}
        onShowHiddenChange={onShowHiddenChange}
      />
    </div>
  );
}
