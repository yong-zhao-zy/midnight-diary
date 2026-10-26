"use client";

import { useMemo, useState } from "react";
import { type DateRange } from "react-day-picker";
import { format } from "date-fns";
import { CalendarDays, Layers, X, Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { type ModuleConfig } from "@/lib/module-config";
import { type DiaryRow } from "@/lib/diary-service";
import { filterDiaries, isModuleFilterActive } from "@/lib/diary-filter";
import { type Granularity } from "@/lib/report-service";
import { QUICK_RANGES } from "@/lib/date-presets";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { RangeCalendar } from "@/components/diary/RangeCalendar";
import { ModuleFilter } from "@/components/diary/ModuleFilter";

interface ReportControlsProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  selectedModules: string[];
  onModulesChange: (ids: string[]) => void;
  moduleConfig: ModuleConfig[];
  activeModuleIds: string[];
  showHidden: boolean;
  onShowHiddenChange: (show: boolean) => void;
  diaryDates: string[];
  granularity: Granularity;
  onGranularityChange: (g: Granularity) => void;
  /** 全量日记：用于日期面板底部「查看 N 篇」实时计数 */
  entries: DiaryRow[];
}

const GRANULARITY_OPTIONS: { value: Granularity; label: string; hint: string }[] = [
  { value: "day", label: "日", hint: "按星期 × 自然周" },
  { value: "week", label: "周", hint: "按周次 × 月份" },
  { value: "month", label: "月", hint: "按月份 × 年份" },
];

/**
 * 概览控制层：从原来 4 层（日期胶囊 + 维度胶囊两行 + 粒度分段）压成一行。
 * 与写日记页同一套语言：点哪个 chip 只开哪个面板，粒度是这个页面独有的主开关，放行尾常驻。
 */
export function ReportControls({
  dateRange,
  onDateRangeChange,
  selectedModules,
  onModulesChange,
  moduleConfig,
  activeModuleIds,
  showHidden,
  onShowHiddenChange,
  diaryDates,
  granularity,
  onGranularityChange,
  entries,
}: ReportControlsProps) {
  const [panel, setPanel] = useState<"date" | "module" | null>(null);
  const [pendingRange, setPendingRange] = useState<DateRange | undefined>(dateRange);
  const [pendingModules, setPendingModules] = useState<string[]>(selectedModules);

  const hasDate = !!dateRange?.from;
  const hasModuleFilter = isModuleFilterActive(selectedModules, activeModuleIds);

  const dateChipLabel = useMemo(() => {
    if (!dateRange?.from) return "全部日期";
    const from = format(dateRange.from, "MM.dd");
    if (!dateRange.to || dateRange.from.getTime() === dateRange.to.getTime()) return from;
    return `${from}–${format(dateRange.to, "MM.dd")}`;
  }, [dateRange]);

  const moduleChipLabel = useMemo(() => {
    if (!hasModuleFilter) return "全部维度";
    const first = moduleConfig.find((m) => m.id === selectedModules[0]);
    const rest = selectedModules.length - 1;
    return rest > 0 ? `${first?.label ?? "维度"} +${rest}` : first?.label ?? "维度";
  }, [hasModuleFilter, moduleConfig, selectedModules]);

  /** 日期面板计数：维度条件与当前一致（维度只决定显示内容，不筛日记） */
  const datePanelCount = useMemo(
    () =>
      filterDiaries(entries, { dateRange: pendingRange, modules: activeModuleIds }, activeModuleIds)
        .length,
    [entries, pendingRange, activeModuleIds]
  );

  const chipBase =
    "flex h-8 min-w-0 items-center gap-1.5 rounded-full border pl-2.5 pr-3 text-[11px] transition-colors";
  const chipIdle = "border-line-2 bg-surface-1 text-ink-2/75 hover:border-line-3 hover:text-ink-2";
  const chipActive = "border-accent/35 bg-accent/10 text-accent";

  return (
    <div className="mb-3">
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => {
            setPendingRange(dateRange);
            setPanel("date");
          }}
          aria-label="筛选日期范围"
          className={cn(chipBase, "shrink", hasDate ? chipActive : chipIdle)}
        >
          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{dateChipLabel}</span>
        </button>

        <button
          onClick={() => {
            setPendingModules(selectedModules);
            setPanel("module");
          }}
          aria-label="筛选显示维度"
          className={cn(chipBase, "shrink", hasModuleFilter ? chipActive : chipIdle)}
        >
          <Layers className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{moduleChipLabel}</span>
        </button>

        {hasDate && (
          <button
            onClick={() => {
              setPendingRange(undefined);
              onDateRangeChange(undefined);
            }}
            aria-label="清除日期筛选"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line-2 bg-surface-1 text-ink-2/60 transition-colors hover:border-line-3 hover:text-ink"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}

        {/* 粒度：这页独有的主开关，常驻但只占右侧一小段 */}
        <div className="ml-auto flex shrink-0 items-center gap-0.5 rounded-full border border-line-2 bg-surface-1 p-0.5">
          {GRANULARITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onGranularityChange(opt.value)}
              title={opt.hint}
              aria-pressed={granularity === opt.value}
              className={cn(
                "h-7 rounded-full px-2.5 text-[11px] transition-colors",
                granularity === opt.value
                  ? "bg-accent text-accent-ink"
                  : "text-ink-2/60 hover:text-ink"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 面板一：日期 */}
      <Sheet open={panel === "date"} onOpenChange={(o) => !o && setPanel(null)}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="gap-0 rounded-t-3xl border-line-2 bg-elevated p-0 max-h-[88vh]"
        >
          <SheetTitle className="sr-only">筛选日期范围</SheetTitle>
          <SheetDescription className="sr-only">按日期范围查看概览矩阵</SheetDescription>

          <div className="px-5 pt-2.5 pb-3">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-ink/15" />
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-ink">查看范围</h3>
              <button
                onClick={() => setPendingRange(undefined)}
                className="text-xs text-ink-2/70 transition-colors hover:text-ink"
              >
                不限日期
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-5 pb-4">
            <div className="flex flex-wrap gap-1.5">
              {QUICK_RANGES.map((q) => {
                const range = q.build();
                const active =
                  !!pendingRange?.from &&
                  !!pendingRange?.to &&
                  pendingRange.from.getTime() === range.from!.getTime() &&
                  pendingRange.to.getTime() === range.to!.getTime();
                return (
                  <button
                    key={q.key}
                    onClick={() => setPendingRange(range)}
                    className={cn(
                      "h-7 rounded-full border px-3 text-xs transition-colors",
                      active
                        ? "border-accent/35 bg-accent/10 text-accent"
                        : "border-line-2 bg-surface-1 text-ink-2/75 hover:text-ink-2"
                    )}
                  >
                    {q.label}
                  </button>
                );
              })}
            </div>

            <div className="rounded-2xl border border-line-1 bg-surface-1 p-3">
              <RangeCalendar
                selected={pendingRange}
                onSelect={setPendingRange}
                highlightDates={diaryDates}
              />
            </div>
          </div>

          <div className="border-t border-line-1 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button
              onClick={() => {
                onDateRangeChange(pendingRange);
                setPanel(null);
              }}
              className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-accent text-sm font-medium text-accent-ink transition-transform active:scale-[0.99]"
            >
              <Check className="h-4 w-4" />
              查看 {datePanelCount} 篇
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* 面板二：维度（决定格子里显示哪些维度的摘要，不筛日记） */}
      <Sheet open={panel === "module"} onOpenChange={(o) => !o && setPanel(null)}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="gap-0 rounded-t-3xl border-line-2 bg-elevated p-0 max-h-[88vh]"
        >
          <SheetTitle className="sr-only">选择显示维度</SheetTitle>
          <SheetDescription className="sr-only">选择矩阵格子里显示哪些维度的摘要</SheetDescription>

          <div className="px-5 pt-2.5 pb-3">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-ink/15" />
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-ink">显示维度</h3>
              <button
                onClick={() => setPendingModules(activeModuleIds)}
                className="text-xs text-ink-2/70 transition-colors hover:text-ink"
              >
                全选
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-2.5 overflow-y-auto px-5 pb-4">
            <p className="text-[11px] text-ink-2/40">
              已选 {pendingModules.length}/{activeModuleIds.length} · 只影响格子里显示的内容
            </p>
            <ModuleFilter
              moduleConfig={moduleConfig}
              selectedModules={pendingModules}
              onModulesChange={setPendingModules}
              showHidden={showHidden}
              onShowHiddenChange={onShowHiddenChange}
            />
          </div>

          <div className="border-t border-line-1 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button
              onClick={() => {
                onModulesChange(pendingModules);
                setPanel(null);
              }}
              className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-accent text-sm font-medium text-accent-ink transition-transform active:scale-[0.99]"
            >
              <Check className="h-4 w-4" />
              显示 {pendingModules.length} 个维度
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
