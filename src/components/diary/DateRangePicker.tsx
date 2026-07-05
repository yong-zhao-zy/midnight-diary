"use client";

import { useState, useMemo, useEffect, type ReactNode } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import { zhCN } from "date-fns/locale";
import { format, addMonths, subMonths, addYears, subYears, differenceInDays } from "date-fns";
import { X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/cn";

export type { DateRange } from "react-day-picker";

interface DateRangePickerProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  highlightDates?: string[]; // YYYY-MM-DD for hasEntry highlighting
  trailingActions?: ReactNode; // Extra buttons rendered after the trigger (e.g. export button)
  /** Max allowed range in days; shows validation message when exceeded */
  maxRangeDays?: number;
  /** Called whenever the range validity changes (true = valid, false = exceeds limit) */
  onValidationChange?: (isValid: boolean) => void;
}

/**
 * Self-contained date range dropdown.
 * Renders a collapsed trigger button by default; clicking expands the calendar panel.
 * Confirm commits the pending range and collapses; X clears and collapses.
 * Shared by DiaryFilters (list page) and DiaryExportButton (export modal).
 */
export function DateRangePicker({
  dateRange,
  onDateRangeChange,
  highlightDates,
  trailingActions,
  maxRangeDays,
  onValidationChange,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [pendingRange, setPendingRange] = useState<DateRange | undefined>(dateRange);
  const [displayMonth, setDisplayMonth] = useState<Date>(new Date());

  // Check if pending range exceeds maxRangeDays
  const exceedsMaxRange = useMemo(() => {
    if (!maxRangeDays || !pendingRange?.from || !pendingRange?.to) return false;
    return differenceInDays(pendingRange.to, pendingRange.from) > maxRangeDays;
  }, [maxRangeDays, pendingRange]);

  // Notify parent of validation changes
  useEffect(() => {
    if (onValidationChange) {
      onValidationChange(!exceedsMaxRange);
    }
  }, [exceedsMaxRange, onValidationChange]);

  // Function-based modifier for reliable date matching
  const diaryDateSet = useMemo(() => new Set(highlightDates || []), [highlightDates]);
  const hasEntryMatcher = (date: Date) => {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return diaryDateSet.has(dateStr);
  };

  const rangeLabel = useMemo(() => {
    if (!dateRange?.from) return null;
    const fromStr = format(dateRange.from, "MM/dd");
    if (!dateRange.to || dateRange.from.getTime() === dateRange.to.getTime()) return fromStr;
    return `${fromStr} ~ ${format(dateRange.to, "MM/dd")}`;
  }, [dateRange]);

  const handleToggle = () => {
    if (!open) {
      setPendingRange(dateRange);
    }
    setOpen(!open);
  };

  const handleClear = () => {
    onDateRangeChange(undefined);
    setPendingRange(undefined);
    setOpen(false);
  };

  const handleConfirm = () => {
    onDateRangeChange(pendingRange);
    setOpen(false);
  };

  const handleCalendarClear = () => {
    setPendingRange(undefined);
    onDateRangeChange(undefined);
  };

  return (
    <div className="space-y-3">
      {/* Trigger row: toggle button + X clear + trailing actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleToggle}
          className={cn(
            "flex items-center gap-2 h-9 px-4 rounded-2xl text-sm transition-all border flex-1 justify-start",
            open || dateRange
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
            onClick={handleClear}
            className="flex items-center justify-center h-9 w-9 rounded-2xl bg-white/[0.04] border border-white/10 text-muted/60 hover:text-foreground hover:border-white/20 transition-colors shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {trailingActions}
      </div>

      {/* Calendar panel */}
      {open && (
        <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-3 overflow-hidden">
          {/* Custom navigation header: << < 月份 > >> */}
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

          {/* Validation message for max range */}
          {exceedsMaxRange && (
            <p className="text-xs text-rose-400/80 mt-2 text-center">
              最多选择 {maxRangeDays} 天范围
            </p>
          )}

          {/* Confirm / Clear buttons */}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/10">
            <button
              onClick={handleCalendarClear}
              className="flex-1 h-8 rounded-full text-xs border border-white/10 bg-white/[0.02] text-muted/60 hover:text-foreground hover:border-white/20 transition-colors"
            >
              清除
            </button>
            <button
              onClick={handleConfirm}
              disabled={!pendingRange?.from || !pendingRange?.to || exceedsMaxRange}
              className={cn(
                "flex-1 h-8 rounded-full text-xs font-medium transition-all",
                pendingRange?.from && pendingRange?.to && !exceedsMaxRange
                  ? "bg-glow-gold/90 text-midnight hover:bg-glow-gold"
                  : "bg-white/[0.04] text-muted/30 cursor-not-allowed"
              )}
            >
              确认
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
