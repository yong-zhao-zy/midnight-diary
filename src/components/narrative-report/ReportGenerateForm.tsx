"use client";

import { useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { type ModuleConfig, getActiveModules } from "@/lib/module-config";
import { type DiaryRow } from "@/lib/diary-service";
import { QUICK_RANGES } from "@/lib/date-presets";
import { FilterBar } from "@/components/filters/FilterBar";

interface ReportGenerateFormProps {
  diaryDates: string[];
  moduleConfig: ModuleConfig[];
  selectedModules: string[];
  onModulesChange: (ids: string[]) => void;
  showHidden: boolean;
  onShowHiddenChange: (show: boolean) => void;
  isGenerating: boolean;
  onGenerate: (startDate: string, endDate: string, moduleIds: string[]) => void;
  /** 全量日记：筛选面板里算「这次能生成多少篇」 */
  entries: DiaryRow[];
}

/**
 * 报告生成设置：原来是竖排三块（标题 + 日期选择器 + 维度多选 + 生成按钮），
 * 现在压成与写日记、概览同一条筛选框，右上角就是生成按钮。
 *
 * 默认取近 7 天：报告最常见的就是「这周」；不选日期直接点生成也能出东西，
 * 比禁用按钮再让人回头找日期好懂。
 */
export function ReportGenerateForm({
  diaryDates,
  moduleConfig,
  selectedModules,
  onModulesChange,
  showHidden,
  onShowHiddenChange,
  isGenerating,
  onGenerate,
  entries,
}: ReportGenerateFormProps) {
  // 这个组件挂在 ssr:false 的动态导入里，惰性初始化拿到的一定是浏览器时间
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const preset = QUICK_RANGES.find((q) => q.key === "7d");
    return preset ? preset.build() : undefined;
  });

  const activeModuleIds = useMemo(
    () => getActiveModules(moduleConfig).map((m) => m.id),
    [moduleConfig]
  );

  const hasRange = !!dateRange?.from;
  const canGenerate = hasRange && !isGenerating;

  const handleGenerate = () => {
    if (!dateRange?.from || isGenerating) return;
    const startDate = format(dateRange.from, "yyyy-MM-dd");
    const endDate = format(dateRange.to ?? dateRange.from, "yyyy-MM-dd");
    const moduleIds =
      selectedModules.length > 0 ? selectedModules : getActiveModules(moduleConfig).map((m) => m.id);
    onGenerate(startDate, endDate, moduleIds);
  };

  return (
    <div className="mb-6 space-y-2">
      <FilterBar
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        selectedModules={selectedModules}
        onModulesChange={onModulesChange}
        moduleConfig={moduleConfig}
        activeModuleIds={activeModuleIds}
        showHidden={showHidden}
        onShowHiddenChange={onShowHiddenChange}
        diaryDates={diaryDates}
        entries={entries}
        dateAction={(n) => `用这 ${n} 篇生成`}
        moduleAction={(n) => `生成 ${n} 篇的报告`}
        action={
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-full px-3 text-[11.5px] font-medium transition-colors",
              canGenerate
                ? "bg-accent text-accent-ink hover:opacity-90"
                : "bg-surface-2 text-ink-2/35"
            )}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                生成中
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                生成报告
              </>
            )}
          </button>
        }
      />

      {!hasRange && (
        <p className="px-1 text-[11px] text-ink-2/45">先选一个日期范围，才知道用哪几天的日记来写</p>
      )}
    </div>
  );
}
