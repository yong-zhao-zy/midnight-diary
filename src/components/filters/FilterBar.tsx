"use client";

import { useMemo, useState, type ReactNode } from "react";
import { type DateRange } from "react-day-picker";
import { format } from "date-fns";
import { CalendarDays, Check, ChevronRight, MoreHorizontal, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { type ModuleConfig, resolveDotColor } from "@/lib/module-config";
import { type DiaryRow } from "@/lib/diary-service";
import { filterDiaries, isModuleFilterActive } from "@/lib/diary-filter";
import { QUICK_RANGES } from "@/lib/date-presets";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { RangeCalendar } from "@/components/diary/RangeCalendar";
import { ModuleFilter } from "@/components/diary/ModuleFilter";

interface FilterBarProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  selectedModules: string[];
  onModulesChange: (ids: string[]) => void;
  moduleConfig: ModuleConfig[];
  /** 当前启用的维度 id；全选 = 未筛选 */
  activeModuleIds: string[];
  showHidden: boolean;
  onShowHiddenChange: (show: boolean) => void;
  diaryDates: string[];
  /** 全量日记：面板底部「查看 N 篇」的实时计数 */
  entries: DiaryRow[];
  /** 右侧动作区：导出 / 粒度 / 生成报告 */
  action?: ReactNode;
  /** 日期面板底部按钮文案 */
  dateAction?: (count: number) => string;
  /** 维度面板底部按钮文案 */
  moduleAction?: (count: number) => string;
}

/**
 * 三页共用的筛选条：一个圆角小框装下日期与全部维度。
 *
 * 为什么把维度摊开：原来「日期 chip + 维度 chip」两个胶囊都要点开面板才知道选了啥，
 * 而维度是最高频的切换动作。摊开后一次点击即可切换，代价是右端可能要横滑，
 * 所以末尾留一枚 › 提示还有更多。
 *
 * 日期收成图标：日期范围不常改，占一个胶囊的宽度不划算；筛选后图标点亮并跟一段短范围字。
 */
export function FilterBar({
  dateRange,
  onDateRangeChange,
  selectedModules,
  onModulesChange,
  moduleConfig,
  activeModuleIds,
  showHidden,
  onShowHiddenChange,
  diaryDates,
  entries,
  action,
  dateAction,
  moduleAction,
}: FilterBarProps) {
  const [panel, setPanel] = useState<"date" | "module" | null>(null);
  const [pendingRange, setPendingRange] = useState<DateRange | undefined>(dateRange);
  const [pendingModules, setPendingModules] = useState<string[]>(selectedModules);

  const hasDate = !!dateRange?.from;
  const hasModuleFilter = isModuleFilterActive(selectedModules, activeModuleIds);
  const hasInactive = moduleConfig.some((m) => !m.isActive);

  const rangeLabel = useMemo(() => {
    if (!dateRange?.from) return "";
    const from = format(dateRange.from, "MM.dd");
    const to = dateRange.to ? format(dateRange.to, "MM.dd") : from;
    return from === to ? from : `${from}–${to}`;
  }, [dateRange]);

  /** 行内只摊开启用中的维度；停用维度收进「更多」面板 */
  const visibleModules = useMemo(
    () => moduleConfig.filter((m) => showHidden || m.isActive),
    [moduleConfig, showHidden]
  );

  const toggleModule = (id: string) => {
    // 全选状态下点某一个 = 只看这一个（最常见的筛选动作，省一步）
    if (!hasModuleFilter) {
      onModulesChange([id]);
      return;
    }
    if (selectedModules.includes(id)) {
      const next = selectedModules.filter((m) => m !== id);
      onModulesChange(next.length === 0 ? activeModuleIds : next);
    } else {
      onModulesChange([...selectedModules, id]);
    }
  };

  const clearAll = () => {
    setPendingRange(undefined);
    setPendingModules(activeModuleIds);
    onDateRangeChange(undefined);
    onModulesChange(activeModuleIds);
  };

  const datePanelCount = useMemo(
    () =>
      filterDiaries(entries, { dateRange: pendingRange, modules: selectedModules }, activeModuleIds)
        .length,
    [entries, pendingRange, selectedModules, activeModuleIds]
  );

  const modulePanelCount = useMemo(
    () =>
      filterDiaries(entries, { dateRange, modules: pendingModules }, activeModuleIds).length,
    [entries, dateRange, pendingModules, activeModuleIds]
  );

  return (
    <div className="mb-3">
      <div className="flex items-center gap-1 rounded-[14px] border border-line-1 bg-surface-1 p-1">
        {/* 日期：只有图标，筛选后点亮并跟一段短范围 */}
        <button
          type="button"
          onClick={() => {
            setPendingRange(dateRange);
            setPanel("date");
          }}
          aria-label="筛选日期范围"
          className={cn(
            "flex h-8 shrink-0 items-center gap-1.5 rounded-[10px] px-1.5 transition-colors",
            hasDate
              ? "bg-accent/15 text-accent"
              : "text-ink-2/55 hover:bg-surface-3 hover:text-ink-2"
          )}
        >
          <CalendarDays className="h-[15px] w-[15px]" />
          {hasDate && (
            <span className="text-[10.5px] leading-none tabular-nums">{rangeLabel}</span>
          )}
        </button>

        <span className="h-5 w-px shrink-0 bg-line-1" aria-hidden />

        {/* 维度：全部摊开，点一下直接切换 */}
        <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {visibleModules.map((mod) => {
            const idx = moduleConfig.indexOf(mod);
            const active = !hasModuleFilter || selectedModules.includes(mod.id);
            return (
              <button
                key={mod.id}
                type="button"
                onClick={() => toggleModule(mod.id)}
                aria-pressed={active}
                className={cn(
                  "flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2 text-[11.5px] transition-colors",
                  active ? "text-ink" : "text-ink-2/40 hover:text-ink-2/70",
                  !mod.isActive && "opacity-60"
                )}
              >
                <span
                  className={cn(
                    "h-[5px] w-[5px] shrink-0 rounded-full transition-opacity",
                    resolveDotColor(mod.id, idx),
                    !active && "opacity-25"
                  )}
                />
                <span className="whitespace-nowrap">{mod.label}</span>
              </button>
            );
          })}
          <ChevronRight
            className="h-3.5 w-3.5 shrink-0 text-ink-2/25"
            aria-hidden
          />
          {hasInactive && (
            <button
              type="button"
              onClick={() => {
                setPendingModules(selectedModules);
                setPanel("module");
              }}
              aria-label="更多维度设置"
              className="flex h-7 w-6 shrink-0 items-center justify-center text-ink-2/35 transition-colors hover:text-ink-2"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {(hasDate || hasModuleFilter) && (
          <button
            type="button"
            onClick={clearAll}
            aria-label="清除筛选"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-2/45 transition-colors hover:bg-surface-3 hover:text-ink"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}

        {action && (
          <>
            <span className="h-5 w-px shrink-0 bg-line-1" aria-hidden />
            <div className="flex shrink-0 items-center gap-0.5">{action}</div>
          </>
        )}
      </div>

      {/* 面板一：日期 */}
      <Sheet open={panel === "date"} onOpenChange={(o) => !o && setPanel(null)}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="gap-0 rounded-t-3xl border-line-2 bg-elevated p-0 max-h-[88vh]"
        >
          <SheetTitle className="sr-only">筛选日期范围</SheetTitle>
          <SheetDescription className="sr-only">按日期范围筛选内容</SheetDescription>

          <div className="px-5 pt-2.5 pb-3">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-ink/15" />
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-ink">筛选日期</h3>
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
              {dateAction ? dateAction(datePanelCount) : `查看 ${datePanelCount} 篇`}
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* 面板二：维度（停用维度、全选等低频操作收在这里） */}
      <Sheet open={panel === "module"} onOpenChange={(o) => !o && setPanel(null)}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="gap-0 rounded-t-3xl border-line-2 bg-elevated p-0 max-h-[88vh]"
        >
          <SheetTitle className="sr-only">维度设置</SheetTitle>
          <SheetDescription className="sr-only">选择要查看的维度</SheetDescription>

          <div className="px-5 pt-2.5 pb-3">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-ink/15" />
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-ink">维度</h3>
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
              className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-accent text-sm font-medium text-accent-ink transition-transform active:scale-[0.99]"
            >
              <Check className="h-4 w-4" />
              {moduleAction ? moduleAction(modulePanelCount) : `查看 ${modulePanelCount} 篇`}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
