"use client";

import { useMemo, useState } from "react";
import { DayPicker } from "react-day-picker";
import { zhCN } from "date-fns/locale";
import { format, addMonths, subMonths, addYears, subYears } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/cn";

interface WeekDateBarProps {
  /** YYYY-MM-DD，当前选中日期 */
  selectedDate: string;
  /** 选择新日期（含日历） */
  onSelectDate: (dateStr: string) => void;
}

const WEEKDAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

function toDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * 周条日期栏：本次周一至周日（选中日期所在周），周日旁是单日期日历按钮。
 * 日期框样式沿用分析 tab 的 DateRangePicker 日历，改为单日期、图标触发。
 */
export function WeekDateBar({ selectedDate, onSelectDate }: WeekDateBarProps) {
  const [open, setOpen] = useState(false);
  const [displayMonth, setDisplayMonth] = useState<Date>(parseDate(selectedDate));

  const today = useMemo(() => {
    const parts = new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
    return new Date(get("year"), get("month") - 1, get("day"));
  }, []);

  // 选中日期所在周的周一
  const monday = useMemo(() => {
    const d = parseDate(selectedDate);
    const day = d.getDay(); // 0=周日
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d;
  }, [selectedDate]);

  const days = useMemo(() => {
    return WEEKDAY_LABELS.map((label, i) => {
      const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      return { label, date: d, key: toDate(d) };
    });
  }, [monday]);

  const handlePick = (date: Date | undefined) => {
    if (!date) return;
    onSelectDate(toDate(date));
    setOpen(false);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-0.5">
        {days.map(({ label, date, key }) => {
          const isSelected = key === selectedDate;
          const isToday = toDate(date) === toDate(today);
          const isFuture = date.getTime() > today.getTime();
          return (
            <button
              key={key}
              onClick={() => !isFuture && onSelectDate(key)}
              disabled={isFuture}
              className={cn(
                "flex-1 flex flex-col items-center py-1.5 rounded-xl transition-colors",
                isSelected ? "bg-glow-gold/15" : "hover:bg-white/[0.04]",
                isFuture && "opacity-30"
              )}
            >
              <span
                className={cn(
                  "text-xs",
                  isSelected ? "text-glow-gold font-semibold" : "text-muted/60"
                )}
              >
                {label}
              </span>
              <span
                className={cn(
                  "text-[9px] mt-0.5",
                  isSelected ? "text-glow-gold/80" : isToday ? "text-glow-gold/60" : "text-muted/30"
                )}
              >
                {date.getDate()}
              </span>
            </button>
          );
        })}

        {/* 单日期日历按钮 */}
        <div className="relative shrink-0 ml-1">
          <button
            onClick={() => setOpen(!open)}
            className={cn(
              "flex items-center justify-center h-8 w-8 rounded-xl border transition-colors",
              open
                ? "bg-white/[0.06] border-glow-gold/30 text-glow-gold"
                : "bg-white/[0.04] border-white/10 text-muted/60 hover:text-foreground"
            )}
            aria-label="选择日期"
          >
            <CalendarDays className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* 单日期日历面板（样式沿用 DateRangePicker，改为单选、选中即生效） */}
      {open && (
        <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-3 overflow-hidden">
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
            mode="single"
            locale={zhCN}
            weekStartsOn={1}
            month={displayMonth}
            onMonthChange={setDisplayMonth}
            hideNavigation
            selected={parseDate(selectedDate)}
            onSelect={handlePick}
            disabled={[{ after: today }]}
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
              outside: "!opacity-10",
              disabled: "!opacity-10 [&>button]:cursor-not-allowed",
            }}
          />
        </div>
      )}
    </div>
  );
}
