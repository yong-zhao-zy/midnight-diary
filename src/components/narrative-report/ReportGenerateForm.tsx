"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { type ModuleConfig, getActiveModules } from "@/lib/module-config";
import { DateRangePicker, type DateRange } from "@/components/diary/DateRangePicker";
import { ModuleFilter } from "@/components/diary/ModuleFilter";

interface ReportGenerateFormProps {
  diaryDates: string[];
  moduleConfig: ModuleConfig[];
  selectedModules: string[];
  onModulesChange: (ids: string[]) => void;
  showHidden: boolean;
  onShowHiddenChange: (show: boolean) => void;
  isGenerating: boolean;
  onGenerate: (startDate: string, endDate: string, moduleIds: string[]) => void;
}

export function ReportGenerateForm({
  diaryDates,
  moduleConfig,
  selectedModules,
  onModulesChange,
  showHidden,
  onShowHiddenChange,
  isGenerating,
  onGenerate,
}: ReportGenerateFormProps) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [rangeValid, setRangeValid] = useState(true);

  const handleGenerate = () => {
    if (!dateRange?.from || !dateRange?.to || !rangeValid || isGenerating) return;
    const startDate = format(dateRange.from, "yyyy-MM-dd");
    const endDate = format(dateRange.to, "yyyy-MM-dd");
    // Use selected modules, or all active if none explicitly selected
    const moduleIds = selectedModules.length > 0
      ? selectedModules
      : getActiveModules(moduleConfig).map(m => m.id);
    onGenerate(startDate, endDate, moduleIds);
  };

  const canGenerate = dateRange?.from && dateRange?.to && rangeValid && !isGenerating;

  return (
    <div className="space-y-4 mb-6">
      {/* Section title */}
      <div className="flex items-center gap-2 text-sm font-medium text-foreground/80">
        <Sparkles className="h-4 w-4 text-glow-gold/60" />
        报告生成设置
      </div>

      {/* Date range */}
      <DateRangePicker
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        highlightDates={diaryDates}
        maxRangeDays={180}
        onValidationChange={setRangeValid}
      />

      {/* Module multi-select */}
      <ModuleFilter
        moduleConfig={moduleConfig}
        selectedModules={selectedModules}
        onModulesChange={onModulesChange}
        showHidden={showHidden}
        onShowHiddenChange={onShowHiddenChange}
      />

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={!canGenerate}
        className={cn(
          "w-full h-11 rounded-2xl text-sm font-medium transition-all flex items-center justify-center gap-2",
          canGenerate
            ? "bg-glow-gold/90 text-midnight hover:bg-glow-gold shadow-[0_0_20px_-4px_rgba(253,230,138,0.3)]"
            : "bg-white/[0.04] text-muted/30 cursor-not-allowed"
        )}
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            生成中...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            生成报告
          </>
        )}
      </button>
    </div>
  );
}
