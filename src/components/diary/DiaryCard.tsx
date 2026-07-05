"use client";

import { cn } from "@/lib/cn";
import {
  type ModuleConfig,
  getPrefixedLabel,
  getLabelWithHistory,
  resolveDotColor,
  LEGACY_KEY_MAP,
} from "@/lib/module-config";
import { type DiaryRow, getDiaryEffectiveDate } from "@/lib/diary-service";

interface DiaryCardProps {
  entry: DiaryRow;
  moduleConfig: ModuleConfig[];
  /** Only show this specific module (full content, no clamp) */
  filterModule?: string | null;
  /** Show all modules expanded (no clamp) */
  expanded?: boolean;
  onClick?: () => void;
}

function resolveContent(content: Record<string, string>, moduleId: string): string {
  if (content[moduleId]) return content[moduleId];
  for (const [legacyKey, newId] of Object.entries(LEGACY_KEY_MAP)) {
    if (newId === moduleId && content[legacyKey]) {
      return content[legacyKey];
    }
  }
  return "";
}

export function DiaryCard({
  entry,
  moduleConfig,
  filterModule,
  expanded,
  onClick,
}: DiaryCardProps) {
  const date = getDiaryEffectiveDate(entry);
  const formatted = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;

  // Determine which modules to render
  const modulesToShow = filterModule
    ? moduleConfig.filter((m) => m.id === filterModule)
    : moduleConfig;

  // Check if there's any content for this card given the filter
  const hasContent = modulesToShow.some((mod) => {
    const value = resolveContent(entry.content as Record<string, string>, mod.id);
    return value && value.trim();
  });

  if (!hasContent) return null;

  const shouldExpand = expanded || !!filterModule;

  return (
    <article
      onClick={onClick}
      className="animate-in fade-in slide-in-from-bottom-4 duration-300 rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-sm cursor-pointer hover:border-glow-gold/30 hover:bg-white/[0.05] active:scale-[0.98] transition-all"
    >
      {/* Date header */}
      <time className="text-xs text-muted/70 block mb-3">{formatted}</time>

      {/* Module content */}
      <div className="space-y-3">
        {modulesToShow.map((mod) => {
          const globalIdx = moduleConfig.indexOf(mod);
          const value = resolveContent(entry.content as Record<string, string>, mod.id);
          if (!value || !value.trim()) return null;

          const { label, renamed, originalLabel } = getLabelWithHistory(
            mod.id,
            moduleConfig,
            entry.module_labels_snapshot
          );

          return (
            <div key={mod.id} className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full shrink-0",
                    resolveDotColor(mod.id, globalIdx)
                  )}
                />
                <span className="text-xs text-glow-gold/60">
                  {getPrefixedLabel(label, globalIdx)}
                  {renamed && originalLabel && (
                    <span className="text-muted/40 ml-1">
                      (原名: {originalLabel})
                    </span>
                  )}
                </span>
              </div>
              <p
                className={cn(
                  "text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap pl-3.5",
                  !shouldExpand && "line-clamp-2"
                )}
              >
                {value}
              </p>
            </div>
          );
        })}
      </div>
    </article>
  );
}
