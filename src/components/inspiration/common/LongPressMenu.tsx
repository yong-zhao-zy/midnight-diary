"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Copy, Sparkles, CheckSquare, Loader2, X } from "lucide-react";
import { copyText } from "@/lib/clipboard";
import { useToast } from "./Toast";
import { useInspirationStore } from "@/store/inspiration-store";

interface LongPressMenuProps {
  text: string;
  /** True when the menu text came from user's text selection (not full-text fallback).
   *  Only show save options (存为笔记 / 加入打卡) when a selection is present. */
  hasSelection?: boolean;
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
  hasSelection = false,
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
      const data = await res.json().catch(() => null);
      if (res.ok && data?.note) {
        showToast("已存入珍藏碎片");
        // Sync store: prepend new note + invalidate cache for next visit
        useInspirationStore.setState((s) => ({
          notes: [data.note, ...s.notes],
          notesFetchedAt: Date.now(),
        }));
        onSavedNote?.();
        onClose();
      } else {
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
      const data = await res.json().catch(() => null);
      if (res.ok && data?.practice) {
        showToast("已加入心灵练习");
        // Sync store: prepend new practice + invalidate cache for next visit
        useInspirationStore.setState((s) => ({
          practicesActive: [data.practice, ...s.practicesActive],
          practicesFetchedAt: Date.now(),
        }));
        onSavedPractice?.();
        onClose();
      } else {
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
      {/* Backdrop — tap outside to close.
          onTouchStart is intentionally omitted: it would fire when the user
          tries to drag iOS native selection handles, closing the menu and
          clearing the selection. onClick fires only on genuine taps (no drag),
          so handle dragging passes through to the browser's native text
          selection layer. */}
      <div
        className="fixed inset-0 z-[70]"
        onClick={onClose}
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
          {hasSelection && (
            <>
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
            </>
          )}
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
