"use client";

import { useState } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";
import type { NoteRow } from "@/lib/note-service";
import { SourceBadge } from "../common/SourceBadge";
import { GotoDiaryButton } from "../common/GotoDiaryButton";

interface NoteItemProps {
  note: NoteRow;
  index: number;
  onEdit: (note: NoteRow) => void;
  onDelete: (id: string) => Promise<boolean>;
}

function formatDate(createdAt: string): string {
  const d = new Date(createdAt);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

export function NoteItem({ note, index, onEdit, onDelete }: NoteItemProps) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    const ok = await onDelete(note.id);
    if (!ok) {
      setConfirming(false);
    }
    setDeleting(false);
  };

  return (
    <article className="animate-in fade-in slide-in-from-bottom-4 duration-300 rounded-2xl border border-glow-gold/15 bg-white/[0.03] p-4 space-y-3 hover:border-glow-gold/25 transition-colors">
      <div className="flex items-start gap-3">
        <span className="text-xs text-muted/40 font-mono shrink-0 pt-0.5">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div
          className="flex-1 min-w-0 cursor-pointer text-sm text-foreground/85 leading-relaxed line-clamp-3 whitespace-pre-wrap hover:text-glow-gold/90 transition-colors"
          onClick={() => onEdit(note)}
        >
          {note.content}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-2 min-w-0">
          <SourceBadge
            sourceType={note.source_type}
            sourceDiaryDate={note.source_diary_date}
          />
          <span className="text-xs text-muted/40">{formatDate(note.created_at)}</span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <GotoDiaryButton diaryId={note.source_diary_id} />

          <button
            onClick={() => onEdit(note)}
            className="p-1.5 rounded-md text-muted/60 hover:text-glow-gold hover:bg-white/5 transition-colors"
            title="编辑"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>

          {confirming ? (
            <div className="flex items-center gap-1">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="p-1.5 rounded-md text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
                title="确认删除"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setConfirming(false)}
                disabled={deleting}
                className="p-1.5 rounded-md text-muted/60 hover:text-foreground hover:bg-white/5 disabled:opacity-50 transition-colors"
                title="取消"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="p-1.5 rounded-md text-muted/60 hover:text-red-400 hover:bg-red-500/5 transition-colors"
              title="删除"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
