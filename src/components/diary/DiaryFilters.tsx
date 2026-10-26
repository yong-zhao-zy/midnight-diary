"use client";

import { useMemo, useState, type ReactNode } from "react";
import { type DateRange } from "react-day-picker";
import { format, subDays, startOfMonth } from "date-fns";
import { CalendarDays, Layers, X, Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { type ModuleConfig } from "@/lib/module-config";
import { type DiaryRow } from "@/lib/diary-service";
import {
  filterDiaries,
  isModuleFilterActive,
  type DiaryFilterState,
} from "@/lib/diary-filter";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { RangeCalendar } from "./RangeCalendar";
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
  /** 完整日记列表：用于面板内实时统计「查看 N 篇」 */
  entries: DiaryRow[];
  /** 当前启用的维度 id，用于判断「全选 = 未筛选」 */
  activeModuleIds: string[];
}

const QUICK_RANGES: { key: string; label: string; build: () => DateRange }[] = [
  { key: "today", label: "今天", build: () => { const d = startOfDay(new Date()); return { from: d, to: d }; } },
  { key: "7d", label: "近 7 天", build: () => ({ from: subDays(startOfDay(new Date()), 6), to: startOfDay(new Date()) }) },
  { key: "30d", label: "近 30 天", build: () => ({ from: subDays(startOfDay(new Date()), 29), to: startOfDay(new Date()) }) },
  { key: "month", label: "本月", build: () => ({ from: startOfMonth(new Date()), to: startOfDay(new Date()) }) },
];

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/**
 * 日记筛选：常驻一行 chip（日期 / 维度 / 清除），完整功能收进底部面板。
 * 之前 DateRangePicker 触发行 + ModuleFilter 胶囊常驻在列表上方约 100px，
 * 不管用不用都占地方，把日记列表推到第二屏。
 */
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
  entries,
  activeModuleIds,
}: DiaryFiltersProps) {
  const [open, setOpen] = useState(false);
  // 面板内的待确认状态 —— 点「查看 N 篇」才提交，避免边选边刷新列表
  const [pendingRange, setPendingRange] = useState<DateRange | undefined>(dateRange);
  const [pendingModules, setPendingModules] = useState<string[]>(selectedModules);

  const hasDate = !!dateRange?.from;
  const hasModuleFilter = isModuleFilterActive(selectedModules, activeModuleIds);
  const hasAny = hasDate || hasModuleFilter;

  const openSheet = () => {
    setPendingRange(dateRange);
    setPendingModules(selectedModules);
    setOpen(true);
  };

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

  const pendingCount = useMemo(() => {
    const state: DiaryFilterState = { dateRange: pendingRange, modules: pendingModules };
    return filterDiaries(entries, state, activeModuleIds).length;
  }, [entries, pendingRange, pendingModules, activeModuleIds]);

  const apply = () => {
    onDateRangeChange(pendingRange);
    onModulesChange(pendingModules);
    setOpen(false);
  };

  const clearAll = () => {
    setPendingRange(undefined);
    setPendingModules(activeModuleIds);
    onDateRangeChange(undefined);
    onModulesChange(activeModuleIds);
    setOpen(false);
  };

  return (
    <div className="mb-4">
      {/* 常驻一行：日期 chip / 维度 chip / 清除 / 导出 */}
      <div className="flex items-center gap-2">
        <button
          onClick={openSheet}
          className={cn(
            "flex items-center gap-1.5 h-8 pl-2.5 pr-3 rounded-full border text-xs transition-colors",
            hasDate
              ? "border-accent/35 bg-accent/10 text-accent"
              : "border-line-2 bg-surface-1 text-ink-2/75 hover:text-ink-2 hover:border-line-3"
          )}
        >
          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
          <span className="whitespace-nowrap">{dateChipLabel}</span>
        </button>

        <button
          onClick={openSheet}
          className={cn(
            "flex items-center gap-1.5 h-8 pl-2.5 pr-3 rounded-full border text-xs transition-colors",
            hasModuleFilter
              ? "border-accent/35 bg-accent/10 text-accent"
              : "border-line-2 bg-surface-1 text-ink-2/75 hover:text-ink-2 hover:border-line-3"
          )}
        >
          <Layers className="h-3.5 w-3.5 shrink-0" />
          <span className="whitespace-nowrap">{moduleChipLabel}</span>
        </button>

        {hasAny && (
          <button
            onClick={clearAll}
            aria-label="清除筛选"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line-2 bg-surface-1 text-ink-2/60 hover:text-ink hover:border-line-3 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}

        <div className="ml-auto flex items-center gap-1">{actionSlot}</div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="gap-0 p-0 bg-elevated border-line-2 rounded-t-3xl max-h-[88vh]"
        >
          <SheetTitle className="sr-only">筛选日记</SheetTitle>
          <SheetDescription className="sr-only">
            按日期范围和记录维度筛选日记列表
          </SheetDescription>

          {/* 面板头 */}
          <div className="px-5 pt-2.5 pb-3">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-ink/15" />
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-ink">筛选</h3>
              <button
                onClick={() => {
                  setPendingRange(undefined);
                  setPendingModules(activeModuleIds);
                }}
                className="text-xs text-ink-2/70 hover:text-ink transition-colors"
              >
                重置
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-5">
            {/* 日期 */}
            <section className="space-y-2.5">
              <p className="text-[11px] uppercase tracking-wider text-ink-2/50">日期</p>
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
                        "h-7 px-3 rounded-full border text-xs transition-colors",
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
            </section>

            {/* 维度 */}
            <section className="space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-wider text-ink-2/50">维度</p>
                <p className="text-[11px] text-ink-2/40">
                  已选 {pendingModules.length}/{activeModuleIds.length}
                </p>
              </div>
              <ModuleFilter
                moduleConfig={moduleConfig}
                selectedModules={pendingModules}
                onModulesChange={setPendingModules}
                showHidden={showHidden}
                onShowHiddenChange={onShowHiddenChange}
              />
            </section>
          </div>

          {/* 底部提交 */}
          <div className="border-t border-line-1 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button
              onClick={apply}
              className="flex w-full h-11 items-center justify-center gap-1.5 rounded-xl bg-accent text-sm font-medium text-accent-ink active:scale-[0.99] transition-transform"
            >
              <Check className="h-4 w-4" />
              查看 {pendingCount} 篇
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
