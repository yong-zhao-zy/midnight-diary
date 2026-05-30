"use client";

import { X } from "lucide-react";
import { motion } from "framer-motion";
import { MODULE_LABELS, MODULE_DOT_COLORS } from "@/lib/report-service";
import { cn } from "@/lib/cn";
import type { DiaryRow } from "@/lib/diary-service";

interface DiaryPreviewCardProps {
  entry: DiaryRow;
  onClose: () => void;
}

export function DiaryPreviewCard({ entry, onClose }: DiaryPreviewCardProps) {
  const date = new Date(entry.created_at);
  const dateStr = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;

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

        {Object.entries(entry.content).map(([key, value]) => {
          if (!value || !value.trim()) return null;
          return (
            <div key={key} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    MODULE_DOT_COLORS[key]
                  )}
                />
                <span className="text-xs font-medium text-muted/80">
                  {MODULE_LABELS[key] || key}
                </span>
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
