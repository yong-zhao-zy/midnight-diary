"use client";

import { useState, useEffect, useMemo } from "react";
import { DayPicker } from "react-day-picker";
import { zhCN } from "date-fns/locale";
import { format, addMonths, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight, ArrowLeft, Loader2 } from "lucide-react";
import type { PracticeRow } from "@/lib/practice-service";
import { fetchPracticeLogsByMonth } from "@/lib/practice-service";

interface PracticeCalendarViewProps {
  practice: PracticeRow;
  onBack: () => void;
}

export function PracticeCalendarView({ practice, onBack }: PracticeCalendarViewProps) {
  const [displayMonth, setDisplayMonth] = useState<Date>(new Date());
  const [checkedDates, setCheckedDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const year = displayMonth.getFullYear();
  const month = displayMonth.getMonth() + 1;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPracticeLogsByMonth(practice.id, year, month).then((dates) => {
      if (!cancelled) {
        setCheckedDates(new Set(dates));
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [practice.id, year, month]);

  // Function-based modifier for checked-in dates
  const checkedMatcher = useMemo(() => {
    return (date: Date) => {
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      return checkedDates.has(dateStr);
    };
  }, [checkedDates]);

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="p-1.5 rounded-md text-muted/60 hover:text-glow-gold hover:bg-white/5 transition-colors"
          aria-label="返回"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm text-foreground/80 truncate">{practice.title}</h3>
          <p className="text-xs text-muted/50">
            {checkedDates.size} 次打卡 · 本月
          </p>
        </div>
      </header>

      <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-3">
        {/* Custom navigation */}
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setDisplayMonth(subMonths(displayMonth, 1))}
            className="h-7 w-7 flex items-center justify-center rounded-full text-muted/60 hover:text-foreground hover:bg-white/10 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium text-foreground/80">
            {format(displayMonth, "yyyy年M月", { locale: zhCN })}
          </span>
          <button
            onClick={() => setDisplayMonth(addMonths(displayMonth, 1))}
            className="h-7 w-7 flex items-center justify-center rounded-full text-muted/60 hover:text-foreground hover:bg-white/10 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-glow-gold/40" />
          </div>
        ) : (
          <DayPicker
            mode="single"
            locale={zhCN}
            month={displayMonth}
            onMonthChange={setDisplayMonth}
            hideNavigation
            modifiers={{ checked: checkedMatcher }}
            modifiersClassNames={{
              checked: "[&>button]:!bg-glow-gold/20 [&>button]:!text-glow-gold [&>button]:!rounded-full [&>button]:font-medium",
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
              day_button: "h-9 w-9 flex items-center justify-center rounded-full text-xs text-muted/40 transition-all hover:bg-white/10 relative",
              today: "!opacity-100 [&>button]:!text-glow-gold [&>button]:font-semibold",
              outside: "!opacity-10",
            }}
          />
        )}
      </div>
    </div>
  );
}
