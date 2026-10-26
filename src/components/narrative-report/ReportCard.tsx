"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { format } from "date-fns";
import type { ReportRow } from "@/lib/narrative-report-service";

interface ReportCardProps {
  report: ReportRow;
  index: number;
  onView: (report: ReportRow) => void;
  onRename: (id: string, theme: string) => void;
  onDelete: (id: string) => void;
}

export function ReportCard({
  report,
  index,
  onView,
  onRename,
  onDelete,
}: ReportCardProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(report.theme);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const startStr = format(new Date(report.start_date + "T00:00:00"), "M月d日");
  const endStr = format(new Date(report.end_date + "T00:00:00"), "M月d日");

  // Build dimension label from stored metadata
  const dimensionLabel = (() => {
    const snapshot = report.content.moduleLabelsSnapshot;
    if (!snapshot) return null;
    const names = Object.values(snapshot);
    if (names.length === 0) return null;
    const allActiveCount = report.content.allActiveModuleCount ?? 0;
    if (allActiveCount > 0 && names.length >= allActiveCount) return "全部维度";
    if (names.length > 3) return `${names.slice(0, 3).join(" / ")} 等 ${names.length} 项`;
    return names.join(" / ");
  })();
  const dimensionFull = report.content.moduleLabelsSnapshot
    ? Object.values(report.content.moduleLabelsSnapshot).join(" / ")
    : null;

  const handleSaveRename = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== report.theme) {
      onRename(report.id, trimmed);
    }
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSaveRename();
    if (e.key === "Escape") {
      setEditValue(report.theme);
      setEditing(false);
    }
  };

  return (
    <>
      <motion.article
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: index * 0.05 }}
        className="rounded-2xl border border-line-2 bg-surface-2 p-5 cursor-pointer hover:border-accent/30 hover:bg-surface-3 transition-all"
        onClick={() => !editing && !confirmDelete && onView(report)}
      >
        {/* Date range */}
        <p className="text-xs text-ink-2/60 mb-2">
          {startStr} ~ {endStr}
        </p>

        {/* Theme - inline editable */}
        <div className="flex items-center gap-2">
          {editing ? (
            <div
              className="flex-1 flex items-center gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleSaveRename}
                maxLength={50}
                className="flex-1 bg-surface-4 border border-accent/30 rounded-lg px-3 py-1.5 text-sm text-ink/90 outline-none"
              />
              <button
                onClick={handleSaveRename}
                className="h-7 w-7 flex items-center justify-center rounded-full bg-accent/20 text-accent hover:bg-accent/30 transition-colors"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <h3 className="flex-1 text-base font-medium text-ink/90 truncate">
              {report.theme}
            </h3>
          )}

          {/* Action buttons */}
          {!editing && (
            <div
              className="flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  setEditValue(report.theme);
                  setEditing(true);
                }}
                className="h-7 w-7 flex items-center justify-center rounded-full text-ink-2/50 hover:text-ink hover:bg-surface-5 transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="h-7 w-7 flex items-center justify-center rounded-full text-ink-2/50 hover:text-rose-400 hover:bg-rose-400/10 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Dimension labels */}
        {dimensionLabel && (
          <p
            className="text-xs text-ink-2/50 mt-3"
            title={dimensionFull ?? undefined}
          >
            维度：{dimensionLabel}
          </p>
        )}

        {/* Created date */}
        <p className="text-[10px] text-ink-2/40 mt-1">
          生成于 {format(new Date(report.created_at), "yyyy.MM.dd HH:mm")}
        </p>
      </motion.article>

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-6"
            onClick={() => setConfirmDelete(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-elevated-2 border border-line-2 rounded-2xl p-6 w-full max-w-sm space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-sm text-ink/80 text-center">
                确认删除这份报告？
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 h-9 rounded-full text-sm border border-line-2 bg-surface-1 text-ink-2/70 hover:text-ink transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    onDelete(report.id);
                    setConfirmDelete(false);
                  }}
                  className="flex-1 h-9 rounded-full text-sm bg-rose-500/20 border border-rose-500/30 text-rose-400 hover:bg-rose-500/30 transition-colors"
                >
                  删除
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
