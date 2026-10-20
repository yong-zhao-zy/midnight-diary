"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { X, Pencil, RotateCcw, Loader2, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import type { DiaryRow } from "@/lib/diary-service";
import { getDiaryDateStr } from "@/lib/diary-service";
import {
  type ModuleConfig,
  getPrefixedLabel,
  getLabelWithHistory,
  resolveDotColor,
} from "@/lib/module-config";
import { getModuleText, getModuleAiSummary } from "@/lib/module-text";
import { overrideMaxLen, overrideKey, type OverrideScope } from "@/lib/summary-override-service";
import { useSummaryOverrideStore } from "@/store/summary-override-store";
import { usePeriodSummaryStore } from "@/store/period-summary-store";
import {
  formatMonthDay,
  getPeriodLabel,
  type PeriodScope,
} from "@/lib/period-summary-service";

interface PeriodPreviewCardProps {
  scope: PeriodScope;
  periodKey: string;
  /** 该周期内的全部日记 */
  entries: DiaryRow[];
  moduleConfig: ModuleConfig[];
  showHidden: boolean;
  onClose: () => void;
}

interface DayRow {
  dateKey: string;
  text: string;
}

/**
 * 周/月弹窗：日期范围 → 每模块的日摘要列表（用户编辑优先）→ 该周期 AI 摘要（可编辑）。
 *
 * 显示规则：
 *   日摘要  = override(day) ?? AI 日摘要 ?? 正文前 20 字
 *   周期摘要 = override(week/month) ?? AI 周期摘要（period_summaries）
 * 用户编辑的周期摘要永不被自动刷新覆盖（AI 只写 period_summaries）。
 */
export function PeriodPreviewCard({
  scope,
  periodKey,
  entries,
  moduleConfig,
  showHidden,
  onClose,
}: PeriodPreviewCardProps) {
  const overrideByKey = useSummaryOverrideStore((s) => s.byKey);
  const setOverrideContent = useSummaryOverrideStore((s) => s.setContent);
  const ensureScope = useSummaryOverrideStore((s) => s.ensureScope);
  const setAiSummariesCache = usePeriodSummaryStore((s) => s.setSummaries);

  const periodOverrides = overrideByKey[overrideKey(scope, periodKey)] ?? {};
  const maxLen = overrideMaxLen(scope);

  const [aiSummaries, setAiSummaries] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [editingModule, setEditingModule] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [savingModule, setSavingModule] = useState<string | null>(null);
  const [errorModule, setErrorModule] = useState<string | null>(null);

  const visibleModules = useMemo(
    () => (showHidden ? moduleConfig : moduleConfig.filter((m) => m.isActive)),
    [moduleConfig, showHidden]
  );

  const loadPeriodSummary = useCallback(
    async (force = false) => {
      setLoading(true);
      setLoadError(false);
      try {
        const res = await fetch("/api/period-summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scope,
            periodKey,
            modules: visibleModules.map((m) => ({ id: m.id, label: m.label })),
            force,
          }),
        });
        const json = (await res.json().catch(() => ({}))) as {
          summaries?: Record<string, string>;
          error?: string;
        };
        if (!res.ok) throw new Error(json.error || "生成失败");
        setAiSummaries(json.summaries ?? {});
        // 回写缓存 store → 概览表格的格子立刻显示新生成的周/月摘要
        setAiSummariesCache(scope, periodKey, json.summaries ?? {});
      } catch (err) {
        console.error("Load period summary failed:", err);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    },
    [scope, periodKey, visibleModules, setAiSummariesCache]
  );

  // 周期切换时重新拉取（覆盖层 + AI 摘要）
  useEffect(() => {
    ensureScope(scope as OverrideScope);
    let active = true;
    // 放到微任务里执行，避免在 effect 同步阶段触发 setState 引发级联渲染
    void Promise.resolve().then(() => {
      if (active) void loadPeriodSummary();
    });
    return () => {
      active = false;
    };
  }, [ensureScope, loadPeriodSummary, scope]);

  const startEdit = (moduleId: string, current: string) => {
    setEditingModule(moduleId);
    setDraft(current);
    setErrorModule(null);
  };

  const handleSave = async (moduleId: string) => {
    const content = draft.trim();
    if (content.length > maxLen) {
      setErrorModule(moduleId);
      return;
    }
    setSavingModule(moduleId);
    setErrorModule(null);
    try {
      const res = await fetch("/api/summary-overrides", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, periodKey, moduleId, content }),
      });
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) throw new Error(json.error || "保存失败");
      setOverrideContent(scope as OverrideScope, periodKey, moduleId, content || null);
      setEditingModule(null);
      setDraft("");
    } catch (err) {
      console.error("Save period override failed:", err);
      setErrorModule(moduleId);
    } finally {
      setSavingModule(null);
    }
  };

  const handleRestore = async (moduleId: string) => {
    setSavingModule(moduleId);
    setErrorModule(null);
    try {
      const query = new URLSearchParams({ scope, periodKey, moduleId });
      const res = await fetch(`/api/summary-overrides?${query.toString()}`, { method: "DELETE" });
      if (!res.ok) throw new Error("删除失败");
      setOverrideContent(scope as OverrideScope, periodKey, moduleId, null);
      if (editingModule === moduleId) {
        setEditingModule(null);
        setDraft("");
      }
    } catch (err) {
      console.error("Restore period AI summary failed:", err);
      setErrorModule(moduleId);
    } finally {
      setSavingModule(null);
    }
  };

  // 每模块的日摘要列表（用户编辑优先）
  const dayRowsByModule = useMemo(() => {
    const map: Record<string, DayRow[]> = {};
    const sorted = [...entries].sort((a, b) =>
      getDiaryDateStr(a).localeCompare(getDiaryDateStr(b))
    );

    for (const mod of visibleModules) {
      const rows: DayRow[] = [];
      for (const entry of sorted) {
        const dateKey = getDiaryDateStr(entry);
        // 用户编辑过的日摘要优先，其次 AI 摘要，最后退回正文前 20 字
        const text =
          overrideByKey[overrideKey("day", dateKey)]?.[mod.id] ||
          getModuleAiSummary(entry.module_summaries, mod.id) ||
          getModuleText(entry.content, mod.id).trim().slice(0, 20);
        if (text) rows.push({ dateKey, text });
      }
      map[mod.id] = rows;
    }
    return map;
  }, [entries, visibleModules, overrideByKey]);

  const hasAnyContent = visibleModules.some((m) => dayRowsByModule[m.id]?.length > 0);
  const periodCount = entries.length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[88vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-deep-blue border border-white/10"
      >
        {/* 头部 */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/[0.07]">
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-glow-gold truncate">
              {getPeriodLabel(scope, periodKey)}
            </h3>
            <p className="text-[10px] text-muted/45 mt-0.5">
              {scope === "week" ? "周" : "月"}摘要 · {periodCount} 篇日记
              {loading && " · 提炼中…"}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => loadPeriodSummary(true)}
              disabled={loading}
              title="重新生成周期摘要"
              className="p-1.5 rounded-lg text-muted/50 hover:text-foreground hover:bg-white/5 transition-colors disabled:opacity-40"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-white/5 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {!hasAnyContent && !loading && (
            <p className="text-xs text-muted/50 text-center py-8">
              这个{scope === "week" ? "周" : "月"}还没有可提炼的内容
            </p>
          )}

          {visibleModules.map((mod, idx) => {
            const dayRows = dayRowsByModule[mod.id] ?? [];
            const aiSummary = aiSummaries[mod.id] ?? "";
            const userSummary = periodOverrides[mod.id];
            const displaySummary = userSummary ?? aiSummary;
            const isOverridden = !!userSummary;
            const isEditing = editingModule === mod.id;
            const isSaving = savingModule === mod.id;

            if (dayRows.length === 0 && !displaySummary) return null;

            const snapshot =
              entries.find((e) => e.module_labels_snapshot?.[mod.id])?.module_labels_snapshot ?? null;
            const { label, renamed, originalLabel } = getLabelWithHistory(
              mod.id,
              moduleConfig,
              snapshot
            );

            return (
              <div key={mod.id} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full", resolveDotColor(mod.id, idx))} />
                  <span className="text-xs font-medium text-muted/80">
                    {getPrefixedLabel(label, idx)}
                  </span>
                  {renamed && originalLabel && (
                    <span className="text-[9px] text-muted/40">(原名: {originalLabel})</span>
                  )}
                  {!mod.isActive && <span className="text-[9px] text-muted/40">(已停用)</span>}
                </div>

                {/* 该周期内每日摘要 */}
                {dayRows.length > 0 && (
                  <div className="ml-4 space-y-1">
                    {dayRows.map((row) => (
                      <div key={row.dateKey} className="flex items-start gap-2">
                        <span className="text-[10px] text-muted/35 w-9 shrink-0 pt-0.5 leading-relaxed">
                          {formatMonthDay(row.dateKey)}
                        </span>
                        <span className="text-xs text-foreground/70 leading-relaxed">
                          {row.text}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* 周期 AI 摘要（可编辑覆盖） */}
                <div className="ml-4 rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-2 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-muted/45">
                      {scope === "week" ? "周摘要" : "月摘要"}
                      {isOverridden ? " · 已编辑" : " · AI 生成"}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {isSaving && <Loader2 className="h-3 w-3 text-muted/50 animate-spin" />}
                      {isOverridden && !isEditing && !isSaving && (
                        <button
                          onClick={() => handleRestore(mod.id)}
                          title="恢复 AI 摘要"
                          className="p-1 rounded-md text-muted/50 hover:text-foreground hover:bg-white/5 transition-colors"
                        >
                          <RotateCcw className="h-3 w-3" />
                        </button>
                      )}
                      {!isEditing && !isSaving && (
                        <button
                          onClick={() => startEdit(mod.id, displaySummary)}
                          title="编辑摘要"
                          className="p-1 rounded-md text-muted/50 hover:text-foreground hover:bg-white/5 transition-colors"
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
                        maxLength={maxLen}
                        rows={2}
                        autoFocus
                        placeholder={`写下这个${scope === "week" ? "周" : "月"}的摘要`}
                        className="w-full resize-none rounded-md bg-white/[0.04] border border-white/10 px-2 py-1.5 text-xs text-foreground/85 leading-relaxed outline-none focus:border-glow-gold/40"
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted/40">
                          {draft.trim().length}/{maxLen}
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
                      {displaySummary ||
                        (loading
                          ? "正在提炼…"
                          : loadError
                            ? "生成失败，点右上角刷新重试"
                            : "暂无摘要，可点右侧编辑手写")}
                    </p>
                  )}

                  {errorModule === mod.id && (
                    <p className="text-[10px] text-red-400/80">保存失败，请重试</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-4 py-2 border-t border-white/[0.07]">
          <p className="text-[10px] text-muted/35 leading-relaxed">
            {scope === "week" ? "周摘要" : "月摘要"}由上一级摘要提炼；你编辑后永不被自动刷新覆盖，AI
            重新生成只更新 AI 版本。
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
