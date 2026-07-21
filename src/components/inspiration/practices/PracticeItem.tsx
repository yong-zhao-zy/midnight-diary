"use client";

import { useState, useEffect } from "react";
import { Check, Flag, X, Loader2, Trash2 } from "lucide-react";
import type { PracticeRow } from "@/lib/practice-service";
import { getPracticeStats, type PracticeStats } from "@/lib/practice-service";
import { SourceBadge } from "../common/SourceBadge";
import { GotoDiaryButton } from "../common/GotoDiaryButton";

interface PracticeItemProps {
  practice: PracticeRow;
  isChecked: boolean;
  onToggleCheck: (id: string) => void;
  onComplete?: (id: string) => Promise<boolean>;
  onDelete?: (id: string) => Promise<boolean>;
}

export function PracticeItem({
  practice,
  isChecked,
  onToggleCheck,
  onComplete,
  onDelete,
}: PracticeItemProps) {
  const [stats, setStats] = useState<PracticeStats | null>(null);
  const [confirmingComplete, setConfirmingComplete] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isCompleted = practice.status === "completed";

  // Fetch stats on mount + whenever isChecked changes (stats update after checkin toggle)
  useEffect(() => {
    let cancelled = false;
    getPracticeStats(practice.id).then((s) => {
      if (!cancelled) setStats(s);
    });
    return () => {
      cancelled = true;
    };
  }, [practice.id, isChecked]);

  const handleComplete = async () => {
    if (!onComplete) return;
    setCompleting(true);
    const ok = await onComplete(practice.id);
    if (!ok) {
      setConfirmingComplete(false);
    }
    setCompleting(false);
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    const ok = await onDelete(practice.id);
    if (!ok) {
      setConfirmingDelete(false);
    }
    setDeleting(false);
  };

  return (
    <article className="animate-in fade-in slide-in-from-bottom-4 duration-300 rounded-2xl border border-glow-gold/15 bg-white/[0.03] p-4 space-y-2.5 hover:border-glow-gold/25 transition-colors">
      <div className="flex items-start gap-3">
        {/* Checkbox / completed mark */}
        {isCompleted ? (
          <div className="h-5 w-5 rounded-full bg-glow-gold/20 border border-glow-gold/40 flex items-center justify-center shrink-0 mt-0.5">
            <Check className="h-3 w-3 text-glow-gold" />
          </div>
        ) : (
          <button
            onClick={() => onToggleCheck(practice.id)}
            className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
              isChecked
                ? "bg-glow-gold border-glow-gold"
                : "border-white/20 hover:border-glow-gold/50"
            }`}
            aria-label={isChecked ? "取消今日打卡" : "标记今日已打卡"}
          >
            {isChecked && <Check className="h-3 w-3 text-midnight" strokeWidth={3} />}
          </button>
        )}

        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <p
              className={`text-sm leading-relaxed ${
                isCompleted
                  ? "text-muted/60 line-through decoration-muted/30"
                  : "text-foreground/85"
              }`}
            >
              {practice.title}
            </p>

            <div className="flex items-center gap-1 shrink-0">
              <GotoDiaryButton diaryId={practice.source_diary_id} />

              {/* Complete button (only for active practices) */}
              {!isCompleted && onComplete && (
                confirmingComplete ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleComplete}
                      disabled={completing}
                      className="p-1.5 rounded-md text-glow-gold hover:bg-glow-gold/10 disabled:opacity-50 transition-colors"
                      title="确认完结"
                    >
                      {completing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Flag className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={() => setConfirmingComplete(false)}
                      disabled={completing}
                      className="p-1.5 rounded-md text-muted/60 hover:text-foreground hover:bg-white/5 disabled:opacity-50 transition-colors"
                      title="取消"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmingComplete(true)}
                    className="p-1.5 rounded-md text-muted/60 hover:text-glow-gold hover:bg-white/5 transition-colors"
                    title="完结此练习"
                  >
                    <Flag className="h-3.5 w-3.5" />
                  </button>
                )
              )}

              {/* Delete button */}
              {onDelete && (
                confirmingDelete ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="p-1.5 rounded-md text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
                      title="确认删除"
                    >
                      {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={() => setConfirmingDelete(false)}
                      disabled={deleting}
                      className="p-1.5 rounded-md text-muted/60 hover:text-foreground hover:bg-white/5 disabled:opacity-50 transition-colors"
                      title="取消"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmingDelete(true)}
                    className="p-1.5 rounded-md text-muted/60 hover:text-red-400 hover:bg-red-500/5 transition-colors"
                    title="删除"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )
              )}
            </div>
          </div>

          {/* Source + stats */}
          <div className="flex items-center gap-2 flex-wrap">
            <SourceBadge
              sourceType={practice.source_type}
              sourceDiaryDate={practice.source_diary_date}
            />
            {stats && (
              <span className="text-xs text-muted/50">
                累计打卡 {stats.total_days}天
                {!isCompleted && (
                  <>
                    {" · "}
                    连续打卡 {stats.consecutive_days}天
                  </>
                )}
              </span>
            )}
          </div>

          {/* Completed footer */}
          {isCompleted && practice.completed_at && (
            <p className="text-xs text-muted/40">
              {formatDate(practice.completed_at)}完结
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

function formatDate(isoStr: string): string {
  const d = new Date(isoStr);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}
