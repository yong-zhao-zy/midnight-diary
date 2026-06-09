"use client";

import { useState } from "react";
import { CalendarDays, X, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";
import { type ModuleConfig, getModulePrefix, resolveDotColor } from "@/lib/module-config";

interface DiaryFiltersProps {
  selectedDate: string | null;
  onDateChange: (date: string | null) => void;
  selectedModule: string | null;
  onModuleChange: (moduleId: string | null) => void;
  moduleConfig: ModuleConfig[];
}

export function DiaryFilters({
  selectedDate,
  onDateChange,
  selectedModule,
  onModuleChange,
  moduleConfig,
}: DiaryFiltersProps) {
  const [showHidden, setShowHidden] = useState(false);

  const visibleModules = showHidden
    ? moduleConfig
    : moduleConfig.filter((m) => m.isActive);

  const hasInactiveModules = moduleConfig.some((m) => !m.isActive);

  return (
    <div className="space-y-3 mb-5">
      {/* Date picker + show hidden toggle */}
      <div className="flex items-center gap-2">
        <div className="relative flex items-center flex-1">
          <CalendarDays className="absolute left-3 h-4 w-4 text-muted/60 pointer-events-none" />
          <input
            type="date"
            value={selectedDate || ""}
            onChange={(e) => onDateChange(e.target.value || null)}
            className="w-full h-9 pl-9 pr-3 rounded-2xl bg-white/[0.04] border border-white/10 text-sm text-foreground/80 placeholder:text-muted/40 focus:outline-none focus:border-glow-gold/40 transition-colors appearance-none [color-scheme:dark]"
          />
        </div>
        {selectedDate && (
          <button
            onClick={() => onDateChange(null)}
            className="flex items-center justify-center h-9 w-9 rounded-2xl bg-white/[0.04] border border-white/10 text-muted/60 hover:text-foreground hover:border-white/20 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* Show hidden modules toggle */}
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
      </div>

      {/* Module tags - flex wrap */}
      <div className="flex flex-wrap gap-2">
        {visibleModules.map((mod, idx) => {
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
