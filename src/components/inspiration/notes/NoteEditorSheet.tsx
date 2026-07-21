"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { useInspirationStore } from "@/store/inspiration-store";
import type { NoteRow } from "@/lib/note-service";
import { useToast } from "../common/Toast";

interface NoteEditorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noteToEdit?: NoteRow | null;
}

export function NoteEditorSheet({ open, onOpenChange, noteToEdit }: NoteEditorSheetProps) {
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const addNote = useInspirationStore((s) => s.addNote);
  const updateNote = useInspirationStore((s) => s.updateNote);
  const { showToast, ToastElement } = useToast();

  const isEdit = !!noteToEdit;

  useEffect(() => {
    if (open) {
      setContent(noteToEdit?.content ?? "");
    }
  }, [open, noteToEdit]);

  const handleSave = async () => {
    const trimmed = content.trim();
    if (!trimmed) {
      showToast("内容不能为空");
      return;
    }

    setSaving(true);
    try {
      if (isEdit && noteToEdit) {
        const ok = await updateNote(noteToEdit.id, trimmed);
        if (ok) {
          showToast("已更新");
          onOpenChange(false);
        } else {
          showToast("保存失败");
        }
      } else {
        const note = await addNote({
          content: trimmed,
          source_type: "manual",
        });
        if (note) {
          showToast("已添加");
          onOpenChange(false);
        } else {
          showToast("保存失败");
        }
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="bg-midnight border-white/10 rounded-t-3xl max-h-[80vh]"
      >
        <SheetHeader>
          <SheetTitle className="text-glow-gold">
            {isEdit ? "编辑笔记" : "新增笔记"}
          </SheetTitle>
          <SheetDescription className="text-muted/60">
            {isEdit ? "修改内容将覆盖原文" : "手动添加一条珍藏碎片"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 px-4 overflow-y-auto">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            autoFocus
            placeholder="写下触动你的句子或想法..."
            className="w-full min-h-[180px] bg-white/[0.03] border border-white/8 rounded-xl p-3 text-sm text-foreground leading-relaxed placeholder:text-muted/30 focus:outline-none focus:border-glow-gold/30 resize-none"
          />
        </div>

        <SheetFooter className="border-t border-white/8">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-glow-gold text-midnight text-sm font-semibold disabled:opacity-50 hover:bg-glow-gold/90 active:scale-[0.98] transition-all"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? "保存修改" : "添加笔记"}
          </button>
        </SheetFooter>

        {ToastElement}
      </SheetContent>
    </Sheet>
  );
}
