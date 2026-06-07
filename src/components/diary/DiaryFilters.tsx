"use client";

import { CalendarDays, X } from "lucide-react";
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
  const activeModules = moduleConfig.filter((m) => m.isActive);

  return (
    <div className="space-y-3 mb-5">
      {/* Date picker */}
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
      </div>

      {/* Module tags - horizontal scroll */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
        {activeModules.map((mod, idx) => {
          const globalIdx = moduleConfig.indexOf(mod);
          const active = selectedModule === mod.id;
          return (
            <button
              key={mod.id}
              onClick={() => onModuleChange(active ? null : mod.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs whitespace-nowrap transition-all border shrink-0",
                active
                  ? "border-white/20 bg-white/[0.08] text-foreground shadow-sm"
                  : "border-white/8 bg-white/[0.03] text-muted/60 hover:text-foreground hover:border-white/15"
              )}
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full shrink-0",
                  resolveDotColor(mod.id, globalIdx),
                  !active && "opacity-50"
                )}
              />
              {getModulePrefix(globalIdx)} {mod.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
