"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Copy, Sparkles, CheckSquare, Loader2, X } from "lucide-react";
import { copyText } from "@/lib/clipboard";
import { useToast } from "./Toast";

interface LongPressMenuProps {
  text: string;
  sourceDiaryId?: string | null;
  anchorX: number;
  anchorY: number;
  onClose: () => void;
  onSavedNote?: () => void;
  onSavedPractice?: () => void;
}

type SavingState = "idle" | "note" | "practice";

export function LongPressMenu({
  text,
  sourceDiaryId,
  anchorX,
  anchorY,
  onClose,
  onSavedNote,
  onSavedPractice,
}: LongPressMenuProps) {
  const [saving, setSaving] = useState<SavingState>("idle");
  const { showToast, ToastElement } = useToast();

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Compute position — flip up if anchor is in bottom half
  const viewportH = typeof window !== "undefined" ? window.innerHeight : 800;
  const flipUp = anchorY > viewportH * 0.6;
  const menuTop = flipUp ? anchorY - 8 : anchorY + 8;
  const menuTranslateY = flipUp ? "-100%" : "0";

  const handleCopy = async () => {
    const ok = await copyText(text);
    if (ok) {
      showToast("已复制");
    } else {
      showToast("复制失败");
    }
    onClose();
  };

  const handleSaveNote = async () => {
    setSaving("note");
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: text,
          source_type: "ai_interpretation",
          source_diary_id: sourceDiaryId ?? undefined,
        }),
      });
      if (res.ok) {
        showToast("已存入珍藏碎片");
        onSavedNote?.();
        onClose();
      } else {
        const data = await res.json().catch(() => null);
        showToast(data?.error || "保存失败");
      }
    } catch {
      showToast("网络异常");
    } finally {
      setSaving("idle");
    }
  };

  const handleSavePractice = async () => {
    setSaving("practice");
    try {
      const title = text.slice(0, 50);
      const res = await fetch("/api/practices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          source_type: "ai_interpretation",
          source_diary_id: sourceDiaryId ?? undefined,
        }),
      });
      if (res.ok) {
        showToast("已加入心灵练习");
        onSavedPractice?.();
        onClose();
      } else {
        const data = await res.json().catch(() => null);
        showToast(data?.error || "保存失败");
      }
    } catch {
      showToast("网络异常");
    } finally {
      setSaving("idle");
    }
  };

  return (
    <>
      {/* Backdrop — tap outside to close */}
      <div
        className="fixed inset-0 z-[70]"
        onClick={onClose}
        onTouchStart={onClose}
      />

      {/* Menu */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: flipUp ? 8 : -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", damping: 28, stiffness: 380 }}
        style={{
          position: "fixed",
          left: anchorX,
          top: menuTop,
          transform: `translateY(${menuTranslateY})`,
          maxWidth: "calc(100vw - 32px)",
        }}
        className="z-[71] rounded-xl bg-midnight/90 backdrop-blur-md border border-glow-gold/20 shadow-xl overflow-hidden"
      >
        <div className="flex flex-col">
          <MenuItem
            icon={<Copy className="h-4 w-4" />}
            label="复制"
            onClick={handleCopy}
            disabled={saving !== "idle"}
          />
          <MenuItem
            icon={saving === "note" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            label="存为笔记"
            onClick={handleSaveNote}
            disabled={saving !== "idle"}
          />
          <MenuItem
            icon={saving === "practice" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckSquare className="h-4 w-4" />}
            label="加入打卡"
            onClick={handleSavePractice}
            disabled={saving !== "idle"}
          />
        </div>
      </motion.div>

      {ToastElement}
    </>
  );
}

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

function MenuItem({ icon, label, onClick, disabled }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground/85 hover:bg-glow-gold/10 hover:text-glow-gold transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
    >
      <span className="text-glow-gold/70">{icon}</span>
      {label}
    </button>
  );
}
