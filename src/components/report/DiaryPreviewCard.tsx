"use client";

import { X } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import type { DiaryRow } from "@/lib/diary-service";
import { type ModuleConfig, LEGACY_KEY_MAP } from "@/lib/module-config";

interface DiaryPreviewCardProps {
  entry: DiaryRow;
  onClose: () => void;
  moduleConfig: ModuleConfig[];
  showHidden: boolean;
}

/**
 * Resolve content value for a module from diary entry,
 * checking both new IDs and legacy keys.
 */
function getModuleContent(content: Record<string, string>, moduleId: string): string {
  if (content[moduleId]) return content[moduleId];
  for (const [legacyKey, newId] of Object.entries(LEGACY_KEY_MAP)) {
    if (newId === moduleId && content[legacyKey]) {
      return content[legacyKey];
    }
  }
  return "";
}

export function DiaryPreviewCard({
  entry,
  onClose,
  moduleConfig,
  showHidden,
}: DiaryPreviewCardProps) {
  const date = new Date(entry.created_at);
  const dateStr = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;

  // Determine which modules to display
  const visibleModules = showHidden
    ? moduleConfig
    : moduleConfig.filter((m) => m.isActive);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[70vh] overflow-y-auto rounded-2xl bg-deep-blue border border-white/10 p-5 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-glow-gold">{dateStr}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted hover:text-foreground hover:bg-white/5 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {visibleModules.map((mod) => {
          const value = getModuleContent(entry.content, mod.id);
          if (!value || !value.trim()) return null;
          return (
            <div key={mod.id} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    mod.dotColor
                  )}
                />
                <span className="text-xs font-medium text-muted/80">
                  {mod.label}
                </span>
                {!mod.isActive && (
                  <span className="text-[9px] text-muted/40">(已停用)</span>
                )}
              </div>
              <p className="text-sm text-foreground/90 leading-relaxed pl-4">
                {value}
              </p>
            </div>
          );
        })}
      </motion.div>
    </motion.div>
  );
}
