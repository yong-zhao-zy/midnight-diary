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
                  ? "border-line-3 bg-surface-4 text-ink"
                  : "border-transparent bg-surface-1 text-ink-2/50",
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
                <span className="text-[10px] text-ink-2/50 ml-0.5">(已停用)</span>
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
              ? "border-accent/30 bg-accent/10 text-accent"
              : "border-line-2 bg-surface-1 text-ink-2/70 hover:text-ink-2"
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
