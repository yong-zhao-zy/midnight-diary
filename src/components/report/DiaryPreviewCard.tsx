"use client";

import { useState } from "react";
import { X, Pencil, RotateCcw, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import type { DiaryRow } from "@/lib/diary-service";
import { getDiaryDateStr, getDiaryEffectiveDate } from "@/lib/diary-service";
import {
  type ModuleConfig,
  LEGACY_KEY_MAP,
  extractEventText,
  getPrefixedLabel,
  getLabelWithHistory,
  resolveDotColor,
} from "@/lib/module-config";
import {
  OVERRIDE_MAX_LEN,
  overrideKey,
} from "@/lib/summary-override-service";
import { useSummaryOverrideStore } from "@/store/summary-override-store";

interface DiaryPreviewCardProps {
  entry: DiaryRow;
  onClose: () => void;
  moduleConfig: ModuleConfig[];
  showHidden: boolean;
}

/**
 * Resolve content value for a module from diary entry,
 * checking both new IDs and legacy keys.
 */
function getModuleContent(content: Record<string, string>, moduleId: string): string {
  if (content[moduleId]) return content[moduleId];
  for (const [legacyKey, newId] of Object.entries(LEGACY_KEY_MAP)) {
    if (newId === moduleId && content[legacyKey]) {
      return content[legacyKey];
    }
  }
  return "";
}

/** AI 生成的摘要（module_summaries），兼容历史 key */
function getAiSummary(entry: DiaryRow, moduleId: string): string {
  const summaries = entry.module_summaries;
  if (!summaries) return "";
  if (summaries[moduleId]) return extractEventText(summaries[moduleId]);
  for (const [legacyKey, newId] of Object.entries(LEGACY_KEY_MAP)) {
    if (newId === moduleId && summaries[legacyKey]) {
      return extractEventText(summaries[legacyKey]);
    }
  }
  return "";
}

export function DiaryPreviewCard({
  entry,
  onClose,
  moduleConfig,
  showHidden,
}: DiaryPreviewCardProps) {
  // 展示日期用 diary_date（可编辑），时间部分沿用 created_at
  const date = getDiaryEffectiveDate(entry);
  const dateStr = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  const dateKey = getDiaryDateStr(entry);

  const overrideByKey = useSummaryOverrideStore((s) => s.byKey);
  const setOverrideContent = useSummaryOverrideStore((s) => s.setContent);
  const dayOverrides = overrideByKey[overrideKey("day", dateKey)] ?? {};

  const [editingModule, setEditingModule] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [savingModule, setSavingModule] = useState<string | null>(null);
  const [errorModule, setErrorModule] = useState<string | null>(null);

  // Determine which modules to display
  const visibleModules = showHidden
    ? moduleConfig
    : moduleConfig.filter((m) => m.isActive);

  const startEdit = (moduleId: string, current: string) => {
    setEditingModule(moduleId);
    setDraft(current);
    setErrorModule(null);
  };

  const handleSave = async (moduleId: string) => {
    const content = draft.trim();
    if (content.length > OVERRIDE_MAX_LEN) {
      setErrorModule(moduleId);
      return;
    }
    setSavingModule(moduleId);
    setErrorModule(null);
    try {
      const res = await fetch("/api/summary-overrides", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "day", periodKey: dateKey, moduleId, content }),
      });
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.error || "保存失败");
      }
      setOverrideContent("day", dateKey, moduleId, content || null);
      setEditingModule(null);
      setDraft("");
    } catch (err) {
      console.error("Save summary override failed:", err);
      setErrorModule(moduleId);
    } finally {
      setSavingModule(null);
    }
  };

  const handleRestore = async (moduleId: string) => {
    setSavingModule(moduleId);
    setErrorModule(null);
    try {
      const query = new URLSearchParams({ scope: "day", periodKey: dateKey, moduleId });
      const res = await fetch(`/api/summary-overrides?${query.toString()}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("删除失败");
      setOverrideContent("day", dateKey, moduleId, null);
      if (editingModule === moduleId) {
        setEditingModule(null);
        setDraft("");
      }
    } catch (err) {
      console.error("Restore AI summary failed:", err);
      setErrorModule(moduleId);
    } finally {
      setSavingModule(null);
    }
  };

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
            className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-white/5 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {visibleModules.map((mod, idx) => {
          const value = getModuleContent(entry.content, mod.id);
          if (!value || !value.trim()) return null;

          const { label, renamed, originalLabel } = getLabelWithHistory(
            mod.id,
            moduleConfig,
            entry.module_labels_snapshot
          );

          const aiSummary = getAiSummary(entry, mod.id);
          const userSummary = dayOverrides[mod.id];
          const displaySummary = userSummary ?? aiSummary;
          const isOverridden = !!userSummary;
          const isEditing = editingModule === mod.id;
          const isSaving = savingModule === mod.id;

          return (
            <div key={mod.id} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    resolveDotColor(mod.id, idx)
                  )}
                />
                <span className="text-xs font-medium text-muted/80">
                  {getPrefixedLabel(label, idx)}
                </span>
                {renamed && originalLabel && (
                  <span className="text-[10px] text-muted/50">
                    (原名: {originalLabel})
                  </span>
                )}
                {!mod.isActive && (
                  <span className="text-[10px] text-muted/50">(已停用)</span>
                )}
              </div>
              <p className="text-sm text-foreground/90 leading-relaxed pl-4">
                {value}
              </p>

              {/* 摘要行：默认 AI 摘要，可编辑覆盖 */}
              <div className="ml-4 rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-2 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-muted/60">
                    摘要{isOverridden ? " · 已编辑" : " · AI 生成"}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    {isSaving && <Loader2 className="h-3 w-3 text-muted/60 animate-spin" />}
                    {isOverridden && !isEditing && !isSaving && (
                      <button
                        onClick={() => handleRestore(mod.id)}
                        title="恢复 AI 摘要"
                        className="p-2 rounded-md text-muted/60 hover:text-foreground hover:bg-white/5 transition-colors"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </button>
                    )}
                    {!isEditing && !isSaving && (
                      <button
                        onClick={() => startEdit(mod.id, displaySummary)}
                        title="编辑摘要"
                        className="p-2 rounded-md text-muted/60 hover:text-foreground hover:bg-white/5 transition-colors"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>

                {isEditing ? (
                  <div className="space-y-1.5">
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      maxLength={OVERRIDE_MAX_LEN}
                      rows={2}
                      autoFocus
                      placeholder="写下这一段的摘要"
                      className="w-full resize-none rounded-md bg-white/[0.04] border border-white/10 px-2 py-1.5 text-xs text-foreground/85 leading-relaxed outline-none focus:border-glow-gold/40"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted/50">
                        {draft.trim().length}/{OVERRIDE_MAX_LEN}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingModule(null);
                            setDraft("");
                            setErrorModule(null);
                          }}
                          className="px-2 py-1 rounded-md text-[11px] text-muted/70 hover:text-foreground hover:bg-white/5 transition-colors"
                        >
                          取消
                        </button>
                        <button
                          onClick={() => handleSave(mod.id)}
                          disabled={isSaving}
                          className="px-2.5 py-1 rounded-md text-[11px] text-midnight bg-glow-gold/90 hover:bg-glow-gold transition-colors disabled:opacity-60"
                        >
                          保存
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-foreground/65 leading-relaxed">
                    {displaySummary || "暂无摘要，可点右侧编辑手写"}
                  </p>
                )}

                {errorModule === mod.id && (
                  <p className="text-[10px] text-red-400/80">保存失败，请重试</p>
                )}
              </div>
            </div>
          );
        })}
      </motion.div>
    </motion.div>
  );
}
