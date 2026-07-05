"use client";

import { useState, type ReactNode } from "react";
import { type DateRange } from "react-day-picker";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";
import { type ModuleConfig, getModulePrefix, resolveDotColor } from "@/lib/module-config";
import { DateRangePicker } from "./DateRangePicker";

export type { DateRange } from "react-day-picker";

interface DiaryFiltersProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  selectedModule: string | null;
  onModuleChange: (moduleId: string | null) => void;
  moduleConfig: ModuleConfig[];
  diaryDates: string[];
  actionSlot?: ReactNode;
}

export function DiaryFilters({
  dateRange,
  onDateRangeChange,
  selectedModule,
  onModuleChange,
  moduleConfig,
  diaryDates,
  actionSlot,
}: DiaryFiltersProps) {
  const [showHidden, setShowHidden] = useState(false);

  const visibleModules = showHidden
    ? moduleConfig
    : moduleConfig.filter((m) => m.isActive);

  const hasInactiveModules = moduleConfig.some((m) => !m.isActive);

  return (
    <div className="space-y-3 mb-5">
      <DateRangePicker
        dateRange={dateRange}
        onDateRangeChange={onDateRangeChange}
        highlightDates={diaryDates}
        trailingActions={
          <>
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
            {actionSlot}
          </>
        }
      />

      {/* Module tags - flex wrap */}
      <div className="flex flex-wrap gap-2">
        {visibleModules.map((mod) => {
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
