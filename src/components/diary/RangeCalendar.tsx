"use client";

import { useMemo, useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import { zhCN } from "date-fns/locale";
import { format, addMonths, subMonths, addYears, subYears } from "date-fns";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/cn";

interface RangeCalendarProps {
  selected?: DateRange;
  onSelect: (range: DateRange | undefined) => void;
  /** YYYY-MM-DD 列表：有记录的日期会高亮 */
  highlightDates?: string[];
  className?: string;
}

/**
 * 单月范围日历（带 « ‹ 月份 › » 自定导航）。
 * 日期选择器下拉（DateRangePicker）与底部筛选面板（DiaryFilters）共用同一份实现，
 * 避免两处日历样式和交互漂移。
 */
export function RangeCalendar({
  selected,
  onSelect,
  highlightDates,
  className,
}: RangeCalendarProps) {
  const [displayMonth, setDisplayMonth] = useState<Date>(
    () => selected?.from ?? new Date()
  );

  const diaryDateSet = useMemo(() => new Set(highlightDates || []), [highlightDates]);
  const hasEntryMatcher = (date: Date) => {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return diaryDateSet.has(dateStr);
  };

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setDisplayMonth(subYears(displayMonth, 1))}
            aria-label="上一年"
            className="h-7 w-7 flex items-center justify-center rounded-full text-ink-2/60 hover:text-ink hover:bg-surface-5 transition-colors"
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setDisplayMonth(subMonths(displayMonth, 1))}
            aria-label="上个月"
            className="h-7 w-7 flex items-center justify-center rounded-full text-ink-2/60 hover:text-ink hover:bg-surface-5 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>

        <span className="text-sm font-medium text-ink/80">
          {format(displayMonth, "yyyy年M月", { locale: zhCN })}
        </span>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setDisplayMonth(addMonths(displayMonth, 1))}
            aria-label="下个月"
            className="h-7 w-7 flex items-center justify-center rounded-full text-ink-2/60 hover:text-ink hover:bg-surface-5 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setDisplayMonth(addYears(displayMonth, 1))}
            aria-label="下一年"
            className="h-7 w-7 flex items-center justify-center rounded-full text-ink-2/60 hover:text-ink hover:bg-surface-5 transition-colors"
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
        selected={selected}
        onSelect={(range) => onSelect(range)}
        modifiers={{ hasEntry: hasEntryMatcher }}
        modifiersClassNames={{
          hasEntry: "!opacity-100 [&>button]:!text-ink [&>button]:font-medium",
        }}
        classNames={{
          root: "w-full",
          months: "w-full",
          month: "w-full",
          month_caption: "hidden",
          month_grid: "w-full",
          weekdays: "grid grid-cols-7 w-full mb-1",
          weekday: "w-full flex items-center justify-center text-xs text-ink-2/60 py-1",
          weeks: "w-full",
          week: "grid grid-cols-7 w-full",
          day: "w-full flex items-center justify-center py-0.5 opacity-30",
          day_button:
            "h-9 w-9 flex items-center justify-center rounded-full text-xs text-ink-2/60 transition-all hover:bg-surface-5",
          today: "!opacity-100 [&>button]:!text-accent [&>button]:font-semibold",
          selected: "!opacity-100 [&>button]:!bg-accent [&>button]:!text-accent-ink [&>button]:font-medium",
          range_start:
            "!opacity-100 [&>button]:!bg-accent [&>button]:!text-accent-ink [&>button]:!rounded-full [&>button]:font-medium",
          range_end:
            "!opacity-100 [&>button]:!bg-accent [&>button]:!text-accent-ink [&>button]:!rounded-full [&>button]:font-medium",
          range_middle:
            "!opacity-100 [&>button]:!bg-accent/20 [&>button]:!text-ink [&>button]:!rounded-none",
          outside: "!opacity-10",
        }}
      />
    </div>
  );
}
