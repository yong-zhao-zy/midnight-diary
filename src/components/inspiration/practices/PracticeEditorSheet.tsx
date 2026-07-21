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
import type { PracticeRow } from "@/lib/practice-service";
import { useToast } from "../common/Toast";

interface PracticeEditorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  practiceToEdit?: PracticeRow | null;
}

export function PracticeEditorSheet({ open, onOpenChange, practiceToEdit }: PracticeEditorSheetProps) {
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const addPractice = useInspirationStore((s) => s.addPractice);
  const updatePracticeTitle = useInspirationStore((s) => s.updatePracticeTitle);
  const { showToast, ToastElement } = useToast();

  const isEdit = !!practiceToEdit;

  useEffect(() => {
    if (open) {
      setTitle(practiceToEdit?.title ?? "");
    }
  }, [open, practiceToEdit]);

  const handleSave = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      showToast("练习名称不能为空");
      return;
    }
    if (trimmed.length > 100) {
      showToast("练习名称过长（最多 100 字）");
      return;
    }

    setSaving(true);
    try {
      if (isEdit && practiceToEdit) {
        const ok = await updatePracticeTitle(practiceToEdit.id, trimmed);
        if (ok) {
          showToast("已更新");
          onOpenChange(false);
        } else {
          showToast("保存失败");
        }
      } else {
        const practice = await addPractice({
          title: trimmed,
          source_type: "manual",
        });
        if (practice) {
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
        className="bg-midnight border-white/10 rounded-t-3xl"
      >
        <SheetHeader>
          <SheetTitle className="text-glow-gold">
            {isEdit ? "编辑练习" : "新增练习"}
          </SheetTitle>
          <SheetDescription className="text-muted/60">
            {isEdit ? "修改练习名称" : "手动添加一条心灵练习"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 px-4 overflow-y-auto">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            maxLength={100}
            placeholder="如：每天冥想 10 分钟"
            className="w-full bg-white/[0.03] border border-white/8 rounded-xl p-3 text-sm text-foreground placeholder:text-muted/30 focus:outline-none focus:border-glow-gold/30"
          />
          <p className="text-xs text-muted/40 mt-2">
            {title.length}/100
          </p>
        </div>

        <SheetFooter className="border-t border-white/8">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-glow-gold text-midnight text-sm font-semibold disabled:opacity-50 hover:bg-glow-gold/90 active:scale-[0.98] transition-all"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? "保存修改" : "添加练习"}
          </button>
        </SheetFooter>

        {ToastElement}
      </SheetContent>
    </Sheet>
  );
}
