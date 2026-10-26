"use client";

import { useState, useMemo, useEffect, type ReactNode } from "react";
import { type DateRange } from "react-day-picker";
import { format, differenceInDays } from "date-fns";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { RangeCalendar } from "./RangeCalendar";

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
 * 仍被 DiaryExportButton（导出弹窗）使用；日记列表页已改为 DiaryFilters 的一行 chip + 底部面板。
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

  const exceedsMaxRange = useMemo(() => {
    if (!maxRangeDays || !pendingRange?.from || !pendingRange?.to) return false;
    return differenceInDays(pendingRange.to, pendingRange.from) > maxRangeDays;
  }, [maxRangeDays, pendingRange]);

  useEffect(() => {
    if (onValidationChange) {
      onValidationChange(!exceedsMaxRange);
    }
  }, [exceedsMaxRange, onValidationChange]);

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
              ? "bg-surface-4 border-accent/30 text-ink/90"
              : "bg-surface-2 border-line-2 text-ink-2/70"
          )}
        >
          <span className="text-xs">📅</span>
          {rangeLabel ? (
            <span className="text-ink/80">{rangeLabel}</span>
          ) : (
            <span>选择日期范围</span>
          )}
        </button>

        {dateRange && (
          <button
            onClick={handleClear}
            className="flex items-center justify-center h-9 w-9 rounded-2xl bg-surface-2 border border-line-2 text-ink-2/70 hover:text-ink hover:border-line-3 transition-colors shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {trailingActions}
      </div>

      {/* Calendar panel */}
      {open && (
        <div className="rounded-2xl bg-surface-2 border border-line-2 p-3 overflow-hidden">
          <RangeCalendar
            selected={pendingRange}
            onSelect={setPendingRange}
            highlightDates={highlightDates}
          />

          {exceedsMaxRange && (
            <p className="text-xs text-rose-400/80 mt-2 text-center">
              最多选择 {maxRangeDays} 天范围
            </p>
          )}

          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-line-2">
            <button
              onClick={handleCalendarClear}
              className="flex-1 h-8 rounded-full text-xs border border-line-2 bg-surface-1 text-ink-2/70 hover:text-ink hover:border-line-3 transition-colors"
            >
              清除
            </button>
            <button
              onClick={handleConfirm}
              disabled={!pendingRange?.from || !pendingRange?.to || exceedsMaxRange}
              className={cn(
                "flex-1 h-8 rounded-full text-xs font-medium transition-all",
                pendingRange?.from && pendingRange?.to && !exceedsMaxRange
                  ? "bg-accent/90 text-accent-ink hover:bg-accent"
                  : "bg-surface-2 text-ink-2/40 cursor-not-allowed"
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
