import { Sparkles, PenLine } from "lucide-react";
import type { NoteSourceType } from "@/lib/note-service";
import type { PracticeSourceType } from "@/lib/practice-service";

interface SourceBadgeProps {
  sourceType: NoteSourceType | PracticeSourceType;
  sourceDiaryDate?: string | null;
  className?: string;
}

/**
 * Renders source badge:
 *   - ai_interpretation: "AI解读 · 7月3日" (with diary date)
 *   - manual: "手动添加"
 */
export function SourceBadge({ sourceType, sourceDiaryDate, className }: SourceBadgeProps) {
  if (sourceType === "manual") {
    return (
      <span
        className={`inline-flex items-center gap-1 text-xs text-muted/70 px-2 py-0.5 rounded-full bg-white/[0.04] ${className ?? ""}`}
      >
        <PenLine className="h-3 w-3" />
        手动添加
      </span>
    );
  }

  // ai_interpretation
  let dateLabel = "";
  if (sourceDiaryDate) {
    const [y, m, d] = sourceDiaryDate.split("-").map(Number);
    dateLabel = ` · ${m}月${d}日`;
  }

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs text-glow-gold/80 px-2 py-0.5 rounded-full bg-glow-gold/10 ${className ?? ""}`}
    >
      <Sparkles className="h-3 w-3" />
      AI解读{dateLabel}
    </span>
  );
}
