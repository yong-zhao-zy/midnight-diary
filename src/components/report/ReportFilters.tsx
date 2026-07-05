"use client";

import { cn } from "@/lib/cn";
import { type Granularity } from "@/lib/report-service";

interface ReportFiltersProps {
  granularity: Granularity;
  onGranularityChange: (g: Granularity) => void;
}

const GRANULARITY_OPTIONS: { value: Granularity; label: string }[] = [
  { value: "day", label: "日" },
  { value: "week", label: "周" },
  { value: "month", label: "月" },
];

export function ReportFilters({
  granularity,
  onGranularityChange,
}: ReportFiltersProps) {
  return (
    <div className="flex items-center gap-3">
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
    </div>
  );
}
