"use client";

import { cn } from "@/lib/cn";
import { Eye, EyeOff } from "lucide-react";
import {
  type ModuleConfig,
  getModulePrefix,
  resolveDotColor,
} from "@/lib/module-config";

interface ModuleFilterProps {
  moduleConfig: ModuleConfig[];
  selectedModules: string[];
  onModulesChange: (ids: string[]) => void;
  showHidden: boolean;
  onShowHiddenChange: (show: boolean) => void;
  /** Minimum number of modules that must stay selected (default: 1) */
  minSelected?: number;
}

/**
 * Unified multi-select dimension filter.
 * Shared by Diary List, Summary, and Narrative Report tabs.
 * Renders pill-button grid with dot colors + "显示隐藏维度" toggle.
 */
export function ModuleFilter({
  moduleConfig,
  selectedModules,
  onModulesChange,
  showHidden,
  onShowHiddenChange,
  minSelected = 1,
}: ModuleFilterProps) {
  const visibleModules = showHidden
    ? moduleConfig
    : moduleConfig.filter((m) => m.isActive);

  const hasInactiveModules = moduleConfig.some((m) => !m.isActive);

  const toggleModule = (id: string) => {
    if (selectedModules.includes(id)) {
      if (selectedModules.length <= minSelected) return;
      onModulesChange(selectedModules.filter((m) => m !== id));
    } else {
      onModulesChange([...selectedModules, id]);
    }
  };

  return (
    <div className="space-y-2">
      {/* Module tags - flex wrap */}
      <div className="flex flex-wrap gap-2">
        {visibleModules.map((mod) => {
          const globalIdx = moduleConfig.indexOf(mod);
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

      {/* Show hidden dimensions toggle */}
      {hasInactiveModules && (
        <button
          onClick={() => onShowHiddenChange(!showHidden)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all border w-fit",
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
  );
}
