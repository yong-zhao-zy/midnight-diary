"use client";

import { cn } from "@/lib/cn";
import {
  type Granularity,
  MODULE_KEYS,
  MODULE_LABELS,
  MODULE_DOT_COLORS,
} from "@/lib/report-service";

interface ReportFiltersProps {
  granularity: Granularity;
  onGranularityChange: (g: Granularity) => void;
  selectedModules: string[];
  onModulesChange: (modules: string[]) => void;
}

const GRANULARITY_OPTIONS: { value: Granularity; label: string }[] = [
  { value: "day", label: "日" },
  { value: "week", label: "周" },
  { value: "month", label: "月" },
];

export function ReportFilters({
  granularity,
  onGranularityChange,
  selectedModules,
  onModulesChange,
}: ReportFiltersProps) {
  const toggleModule = (key: string) => {
    if (selectedModules.includes(key)) {
      // Don't allow deselecting all
      if (selectedModules.length <= 1) return;
      onModulesChange(selectedModules.filter((m) => m !== key));
    } else {
      onModulesChange([...selectedModules, key]);
    }
  };

  return (
    <div className="space-y-3">
      {/* Granularity toggle */}
      <div className="flex items-center gap-1 rounded-full bg-white/[0.04] border border-white/10 p-1 w-fit">
        {GRANULARITY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onGranularityChange(opt.value)}
            className={cn(
              "px-4 py-1.5 rounded-full text-xs font-medium transition-all",
              granularity === opt.value
                ? "bg-glow-gold/90 text-midnight"
                : "text-muted/70 hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Module filter */}
      <div className="flex flex-wrap gap-2">
        {MODULE_KEYS.map((key) => {
          const active = selectedModules.includes(key);
          return (
            <button
              key={key}
              onClick={() => toggleModule(key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all border",
                active
                  ? "border-white/20 bg-white/[0.06] text-foreground"
                  : "border-transparent bg-white/[0.02] text-muted/40"
              )}
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full transition-opacity",
                  MODULE_DOT_COLORS[key],
                  !active && "opacity-30"
                )}
              />
              {MODULE_LABELS[key]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
