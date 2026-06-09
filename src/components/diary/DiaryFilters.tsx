"use client";

import { useState, useMemo } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import { zhCN } from "date-fns/locale";
import { format, addMonths, subMonths, addYears, subYears } from "date-fns";
import { X, Eye, EyeOff, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { type ModuleConfig, getModulePrefix, resolveDotColor } from "@/lib/module-config";

export type { DateRange } from "react-day-picker";

interface DiaryFiltersProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  selectedModule: string | null;
  onModuleChange: (moduleId: string | null) => void;
  moduleConfig: ModuleConfig[];
  diaryDates: string[];
}

export function DiaryFilters({
  dateRange,
  onDateRangeChange,
  selectedModule,
  onModuleChange,
  moduleConfig,
  diaryDates,
}: DiaryFiltersProps) {
  const [showHidden, setShowHidden] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [pendingRange, setPendingRange] = useState<DateRange | undefined>(dateRange);
  const [displayMonth, setDisplayMonth] = useState<Date>(new Date());

  console.log("[DiaryFilters] diaryDates原始数据:", diaryDates, "数量:", diaryDates.length);

  const handleToggleCalendar = () => {
    if (!calendarOpen) {
      setPendingRange(dateRange);
    }
    setCalendarOpen(!calendarOpen);
  };

  const visibleModules = showHidden
    ? moduleConfig
    : moduleConfig.filter((m) => m.isActive);

  const hasInactiveModules = moduleConfig.some((m) => !m.isActive);

  // Function-based modifier for reliable date matching
  const diaryDateSet = useMemo(() => new Set(diaryDates), [diaryDates]);
  const hasEntryMatcher = (date: Date) => {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return diaryDateSet.has(dateStr);
  };

  // Display label for selected range
  const rangeLabel = useMemo(() => {
    if (!dateRange?.from) return null;
    const fromStr = format(dateRange.from, "MM/dd");
    if (!dateRange.to || dateRange.from.getTime() === dateRange.to.getTime()) {
      return fromStr;
    }
    return `${fromStr} ~ ${format(dateRange.to, "MM/dd")}`;
  }, [dateRange]);

  return (
    <div className="space-y-3 mb-5">
      {/* Calendar toggle + show hidden toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleToggleCalendar}
          className={cn(
            "flex items-center gap-2 h-9 px-4 rounded-2xl text-sm transition-all border flex-1 justify-start",
            calendarOpen || dateRange
              ? "bg-white/[0.06] border-glow-gold/30 text-foreground/90"
              : "bg-white/[0.04] border-white/10 text-muted/60"
          )}
        >
          <span className="text-xs">📅</span>
          {rangeLabel ? (
            <span className="text-foreground/80">{rangeLabel}</span>
          ) : (
            <span>选择日期范围</span>
          )}
        </button>

        {dateRange && (
          <button
            onClick={() => {
              onDateRangeChange(undefined);
              setPendingRange(undefined);
              setCalendarOpen(false);
            }}
            className="flex items-center justify-center h-9 w-9 rounded-2xl bg-white/[0.04] border border-white/10 text-muted/60 hover:text-foreground hover:border-white/20 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* Show hidden modules toggle */}
        {hasInactiveModules && (
          <button
            onClick={() => setShowHidden(!showHidden)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all border whitespace-nowrap",
              showHidden
                ? "border-glow-gold/30 bg-glow-gold/10 text-glow-gold"
                : "border-white/10 bg-white/[0.02] text-muted/60 hover:text-muted"
            )}
          >
            {showHidden ? (
              <Eye className="h-3 w-3" />
            ) : (
              <EyeOff className="h-3 w-3" />
            )}
            显示隐藏维度
          </button>
        )}
      </div>

      {/* Calendar panel */}
      {calendarOpen && (
        <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-3 overflow-hidden">
          {/* Custom navigation header: << < 2026年6月 > >> */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setDisplayMonth(subYears(displayMonth, 1))}
                className="h-7 w-7 flex items-center justify-center rounded-full text-muted/60 hover:text-foreground hover:bg-white/10 transition-colors"
              >
                <ChevronsLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setDisplayMonth(subMonths(displayMonth, 1))}
                className="h-7 w-7 flex items-center justify-center rounded-full text-muted/60 hover:text-foreground hover:bg-white/10 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>

            <span className="text-sm font-medium text-foreground/80">
              {format(displayMonth, "yyyy年M月", { locale: zhCN })}
            </span>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setDisplayMonth(addMonths(displayMonth, 1))}
                className="h-7 w-7 flex items-center justify-center rounded-full text-muted/60 hover:text-foreground hover:bg-white/10 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => setDisplayMonth(addYears(displayMonth, 1))}
                className="h-7 w-7 flex items-center justify-center rounded-full text-muted/60 hover:text-foreground hover:bg-white/10 transition-colors"
              >
                <ChevronsRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <DayPicker
            mode="range"
            locale={zhCN}
            month={displayMonth}
            onMonthChange={setDisplayMonth}
            hideNavigation
            selected={pendingRange}
            onSelect={setPendingRange}
            modifiers={{ hasEntry: hasEntryMatcher }}
            modifiersClassNames={{
              hasEntry: "!opacity-100 [&>button]:!text-foreground [&>button]:font-medium",
            }}
            classNames={{
              root: "w-full",
              months: "w-full",
              month: "w-full",
              month_caption: "hidden",
              month_grid: "w-full",
              weekdays: "grid grid-cols-7 w-full mb-1",
              weekday: "w-full flex items-center justify-center text-xs text-muted/50 py-1",
              weeks: "w-full",
              week: "grid grid-cols-7 w-full",
              day: "w-full flex items-center justify-center py-0.5 opacity-30",
              day_button: "h-8 w-8 flex items-center justify-center rounded-full text-xs text-muted/40 transition-all hover:bg-white/10",
              today: "!opacity-100 [&>button]:!text-glow-gold [&>button]:font-semibold",
              selected: "!opacity-100 [&>button]:!bg-glow-gold [&>button]:!text-midnight [&>button]:font-medium",
              range_start: "!opacity-100 [&>button]:!bg-glow-gold [&>button]:!text-midnight [&>button]:!rounded-full [&>button]:font-medium",
              range_end: "!opacity-100 [&>button]:!bg-glow-gold [&>button]:!text-midnight [&>button]:!rounded-full [&>button]:font-medium",
              range_middle: "!opacity-100 [&>button]:!bg-glow-gold/20 [&>button]:!text-foreground [&>button]:!rounded-none",
              outside: "!opacity-10",
            }}
          />

          {/* Confirm / Clear buttons */}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/10">
            <button
              onClick={() => {
                setPendingRange(undefined);
                onDateRangeChange(undefined);
              }}
              className="flex-1 h-8 rounded-full text-xs border border-white/10 bg-white/[0.02] text-muted/60 hover:text-foreground hover:border-white/20 transition-colors"
            >
              清除
            </button>
            <button
              onClick={() => {
                onDateRangeChange(pendingRange);
                setCalendarOpen(false);
              }}
              disabled={!pendingRange?.from || !pendingRange?.to}
              className={cn(
                "flex-1 h-8 rounded-full text-xs font-medium transition-all",
                pendingRange?.from && pendingRange?.to
                  ? "bg-glow-gold/90 text-midnight hover:bg-glow-gold"
                  : "bg-white/[0.04] text-muted/30 cursor-not-allowed"
              )}
            >
              确认
            </button>
          </div>
        </div>
      )}

      {/* Module tags - flex wrap */}
      <div className="flex flex-wrap gap-2">
        {visibleModules.map((mod, idx) => {
          const globalIdx = moduleConfig.indexOf(mod);
          const active = selectedModule === mod.id;
          return (
            <button
              key={mod.id}
              onClick={() => onModuleChange(active ? null : mod.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all border",
                active
                  ? "border-white/20 bg-white/[0.06] text-foreground"
                  : "border-transparent bg-white/[0.02] text-muted/40",
                !mod.isActive && "opacity-60 border-dashed"
              )}
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full transition-opacity",
                  resolveDotColor(mod.id, globalIdx),
                  !active && "opacity-30"
                )}
              />
              {getModulePrefix(globalIdx)} {mod.label}
              {!mod.isActive && (
                <span className="text-[9px] text-muted/40 ml-0.5">(已停用)</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
