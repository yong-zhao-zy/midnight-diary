"use client";

import { useState, useMemo } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import { zhCN } from "date-fns/locale";
import {
  format,
  addMonths,
  subMonths,
  addYears,
  subYears,
  differenceInDays,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/cn";

interface ReportGenerateFormProps {
  diaryDates: string[];
  generating: boolean;
  onGenerate: (startDate: string, endDate: string) => void;
}

export function ReportGenerateForm({
  diaryDates,
  generating,
  onGenerate,
}: ReportGenerateFormProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [pendingRange, setPendingRange] = useState<DateRange | undefined>();
  const [displayMonth, setDisplayMonth] = useState<Date>(new Date());

  const diaryDateSet = useMemo(() => new Set(diaryDates), [diaryDates]);
  const hasEntryMatcher = (date: Date) => {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return diaryDateSet.has(dateStr);
  };

  const rangeValid = pendingRange?.from && pendingRange?.to;
  const daySpan = rangeValid
    ? differenceInDays(pendingRange!.to!, pendingRange!.from!)
    : 0;
  const exceedsLimit = daySpan > 180;

  const rangeLabel = useMemo(() => {
    if (!pendingRange?.from) return null;
    const fromStr = format(pendingRange.from, "yyyy.MM.dd");
    if (!pendingRange.to) return fromStr;
    return `${fromStr} - ${format(pendingRange.to, "yyyy.MM.dd")}`;
  }, [pendingRange]);

  const handleGenerate = () => {
    if (!pendingRange?.from || !pendingRange?.to || exceedsLimit) return;
    const startDate = format(pendingRange.from, "yyyy-MM-dd");
    const endDate = format(pendingRange.to, "yyyy-MM-dd");
    onGenerate(startDate, endDate);
  };

  return (
    <div className="space-y-3 mb-6">
      {/* Toggle calendar */}
      <button
        onClick={() => setCalendarOpen(!calendarOpen)}
        className={cn(
          "w-full flex items-center gap-2 h-10 px-4 rounded-2xl text-sm transition-all border",
          calendarOpen || pendingRange
            ? "bg-white/[0.06] border-glow-gold/30 text-foreground/90"
            : "bg-white/[0.04] border-white/10 text-muted/60"
        )}
      >
        <span className="text-xs">📅</span>
        {rangeLabel ? (
          <span className="text-foreground/80">{rangeLabel}</span>
        ) : (
          <span>选择报告日期范围</span>
        )}
      </button>

      {/* Calendar panel */}
      {calendarOpen && (
        <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-3 overflow-hidden">
          {/* Navigation */}
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
              hasEntry:
                "!opacity-100 [&>button]:!text-foreground [&>button]:font-medium",
            }}
            classNames={{
              root: "w-full",
              months: "w-full",
              month: "w-full",
              month_caption: "hidden",
              month_grid: "w-full",
              weekdays: "grid grid-cols-7 w-full mb-1",
              weekday:
                "w-full flex items-center justify-center text-xs text-muted/50 py-1",
              weeks: "w-full",
              week: "grid grid-cols-7 w-full",
              day: "w-full flex items-center justify-center py-0.5 opacity-30",
              day_button:
                "h-8 w-8 flex items-center justify-center rounded-full text-xs text-muted/40 transition-all hover:bg-white/10",
              today:
                "!opacity-100 [&>button]:!text-glow-gold [&>button]:font-semibold",
              selected:
                "!opacity-100 [&>button]:!bg-glow-gold [&>button]:!text-midnight [&>button]:font-medium",
              range_start:
                "!opacity-100 [&>button]:!bg-glow-gold [&>button]:!text-midnight [&>button]:!rounded-full [&>button]:font-medium",
              range_end:
                "!opacity-100 [&>button]:!bg-glow-gold [&>button]:!text-midnight [&>button]:!rounded-full [&>button]:font-medium",
              range_middle:
                "!opacity-100 [&>button]:!bg-glow-gold/20 [&>button]:!text-foreground [&>button]:!rounded-none",
              outside: "!opacity-10",
            }}
          />

          {/* Validation message */}
          {exceedsLimit && (
            <p className="text-xs text-rose-400/80 mt-2 text-center">
              最多选择 180 天范围
            </p>
          )}
        </div>
      )}

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={!rangeValid || exceedsLimit || generating}
        className={cn(
          "w-full h-11 rounded-2xl text-sm font-medium transition-all flex items-center justify-center gap-2",
          rangeValid && !exceedsLimit && !generating
            ? "bg-glow-gold/90 text-midnight hover:bg-glow-gold shadow-[0_0_20px_-4px_rgba(253,230,138,0.3)]"
            : "bg-white/[0.04] text-muted/30 cursor-not-allowed"
        )}
      >
        <Sparkles className="h-4 w-4" />
        开始分析并生成报告
      </button>
    </div>
  );
}
