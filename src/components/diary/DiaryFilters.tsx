"use client";

import { useMemo, useState, type ReactNode } from "react";
import { type DateRange } from "react-day-picker";
import { format } from "date-fns";
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
import { QUICK_RANGES } from "@/lib/date-presets";

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

/**
 * 日记筛选：常驻一行 chip，点哪个 chip 只开哪个面板（方案 A）。
 * 之前两个 chip 打开的是同一个综合面板——点「日期」却看到维度设置，交互自相矛盾；
 * 现在「日期」「维度」各自独立成面板，所见即所改，每个面板底部仍是「查看 N 篇」。
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
  const [panel, setPanel] = useState<"date" | "module" | null>(null);
  // 面板内的待确认状态 —— 点「查看 N 篇」才提交，避免边选边刷新列表
  const [pendingRange, setPendingRange] = useState<DateRange | undefined>(dateRange);
  const [pendingModules, setPendingModules] = useState<string[]>(selectedModules);

  const hasDate = !!dateRange?.from;
  const hasModuleFilter = isModuleFilterActive(selectedModules, activeModuleIds);
  const hasAny = hasDate || hasModuleFilter;

  const openDatePanel = () => {
    setPendingRange(dateRange);
    setPanel("date");
  };

  const openModulePanel = () => {
    setPendingModules(selectedModules);
    setPanel("module");
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

  /** 日期面板的预览数：只把待确认的日期叠在当前维度条件上 */
  const datePanelCount = useMemo(() => {
    const state: DiaryFilterState = { dateRange: pendingRange, modules: selectedModules };
    return filterDiaries(entries, state, activeModuleIds).length;
  }, [entries, pendingRange, selectedModules, activeModuleIds]);

  /** 维度面板的预览数：只把待确认的维度叠在当前日期条件上 */
  const modulePanelCount = useMemo(() => {
    const state: DiaryFilterState = { dateRange, modules: pendingModules };
    return filterDiaries(entries, state, activeModuleIds).length;
  }, [entries, dateRange, pendingModules, activeModuleIds]);

  const clearAll = () => {
    setPendingRange(undefined);
    setPendingModules(activeModuleIds);
    onDateRangeChange(undefined);
    onModulesChange(activeModuleIds);
  };

  const chipBase =
    "flex items-center gap-1.5 h-8 pl-2.5 pr-3 rounded-full border text-xs transition-colors";
  const chipIdle = "border-line-2 bg-surface-1 text-ink-2/75 hover:text-ink-2 hover:border-line-3";
  const chipActive = "border-accent/35 bg-accent/10 text-accent";

  return (
    <div className="mb-3">
      {/* 常驻一行：日期 chip / 维度 chip / 清除 / 导出 */}
      <div className="flex items-center gap-2">
        <button
          onClick={openDatePanel}
          aria-label="筛选日期"
          className={cn(chipBase, hasDate ? chipActive : chipIdle)}
        >
          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
          <span className="whitespace-nowrap">{dateChipLabel}</span>
        </button>

        <button
          onClick={openModulePanel}
          aria-label="筛选维度"
          className={cn(chipBase, hasModuleFilter ? chipActive : chipIdle)}
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

      {/* 面板一：只有日期 */}
      <Sheet open={panel === "date"} onOpenChange={(o) => !o && setPanel(null)}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="gap-0 p-0 bg-elevated border-line-2 rounded-t-3xl max-h-[88vh]"
        >
          <SheetTitle className="sr-only">筛选日期</SheetTitle>
          <SheetDescription className="sr-only">按日期范围筛选日记列表</SheetDescription>

          <div className="px-5 pt-2.5 pb-3">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-ink/15" />
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-ink">筛选日期</h3>
              <button
                onClick={() => setPendingRange(undefined)}
                className="text-xs text-ink-2/70 hover:text-ink transition-colors"
              >
                不限日期
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-3">
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
          </div>

          <div className="border-t border-line-1 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button
              onClick={() => {
                onDateRangeChange(pendingRange);
                setPanel(null);
              }}
              className="flex w-full h-11 items-center justify-center gap-1.5 rounded-xl bg-accent text-sm font-medium text-accent-ink active:scale-[0.99] transition-transform"
            >
              <Check className="h-4 w-4" />
              查看 {datePanelCount} 篇
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* 面板二：只有维度 */}
      <Sheet open={panel === "module"} onOpenChange={(o) => !o && setPanel(null)}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="gap-0 p-0 bg-elevated border-line-2 rounded-t-3xl max-h-[88vh]"
        >
          <SheetTitle className="sr-only">筛选维度</SheetTitle>
          <SheetDescription className="sr-only">按记录维度筛选日记列表</SheetDescription>

          <div className="px-5 pt-2.5 pb-3">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-ink/15" />
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-ink">筛选维度</h3>
              <button
                onClick={() => setPendingModules(activeModuleIds)}
                className="text-xs text-ink-2/70 hover:text-ink transition-colors"
              >
                全选
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-2.5">
            <p className="text-[11px] text-ink-2/40">
              已选 {pendingModules.length}/{activeModuleIds.length}
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
              className="flex w-full h-11 items-center justify-center gap-1.5 rounded-xl bg-accent text-sm font-medium text-accent-ink active:scale-[0.99] transition-transform"
            >
              <Check className="h-4 w-4" />
              查看 {modulePanelCount} 篇
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
