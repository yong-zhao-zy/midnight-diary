import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

interface GotoDiaryButtonProps {
  diaryId?: string | null;
  className?: string;
}

/**
 * "跳转日记原文" button.
 * - If diaryId is present (AI-sourced): renders as a Link to /write?id=[id], clickable.
 * - If diaryId is absent (manual): renders as a disabled button, grayed out.
 */
export function GotoDiaryButton({ diaryId, className }: GotoDiaryButtonProps) {
  const baseClass = `inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors ${className ?? ""}`;

  if (!diaryId) {
    return (
      <button
        type="button"
        disabled
        className={`${baseClass} text-muted/30 bg-white/[0.02] cursor-not-allowed`}
        title="手动添加的内容无关联日记"
      >
        <ArrowUpRight className="h-3 w-3" />
        原文
      </button>
    );
  }

  return (
    <Link
      href={`/write?id=${diaryId}`}
      className={`${baseClass} text-muted/70 hover:text-glow-gold hover:bg-glow-gold/10`}
      title="跳转日记原文"
    >
      <ArrowUpRight className="h-3 w-3" />
      原文
    </Link>
  );
}
