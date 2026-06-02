"use client";

import { cn } from "@/lib/cn";
import { Eye, EyeOff } from "lucide-react";
import { type Granularity } from "@/lib/report-service";
import { type ModuleConfig } from "@/lib/module-config";

interface ReportFiltersProps {
  granularity: Granularity;
  onGranularityChange: (g: Granularity) => void;
  selectedModules: string[];
  onModulesChange: (modules: string[]) => void;
  moduleConfig: ModuleConfig[];
  showHidden: boolean;
  onShowHiddenChange: (show: boolean) => void;
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
  moduleConfig,
  showHidden,
  onShowHiddenChange,
}: ReportFiltersProps) {
  // Determine which modules to show in the filter
  const visibleModules = showHidden
    ? moduleConfig
    : moduleConfig.filter((m) => m.isActive);

  const toggleModule = (id: string) => {
    if (selectedModules.includes(id)) {
      // Don't allow deselecting all
      if (selectedModules.length <= 1) return;
      onModulesChange(selectedModules.filter((m) => m !== id));
    } else {
      onModulesChange([...selectedModules, id]);
    }
  };

  const hasInactiveModules = moduleConfig.some((m) => !m.isActive);

  return (
    <div className="space-y-3">
      {/* Granularity toggle */}
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

        {/* Show hidden dimensions toggle */}
        {hasInactiveModules && (
          <button
            onClick={() => onShowHiddenChange(!showHidden)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all border",
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

      {/* Module filter */}
      <div className="flex flex-wrap gap-2">
        {visibleModules.map((mod) => {
          const active = selectedModules.includes(mod.id);
          return (
            <button
              key={mod.id}
              onClick={() => toggleModule(mod.id)}
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
                  mod.dotColor,
                  !active && "opacity-30"
                )}
              />
              {mod.label}
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
