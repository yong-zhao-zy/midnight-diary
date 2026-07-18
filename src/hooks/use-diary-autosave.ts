"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveDraft } from "@/lib/draft";

export type AutoSaveStatus = "idle" | "saving" | "saved" | "error";

export interface UseDiaryAutoSaveOptions {
  /** 编辑内容（按模块 id 索引） */
  content: Record<string, string>;
  /**
   * 若提供 → 走云端 PATCH /api/diaries/[id]；
   * 若缺省 → 走 localStorage 草稿（与现有新增页行为一致）。
   */
  diaryId?: string | null;
  /** 云端模式必传；localStorage 模式可省略 */
  labelsSnapshot?: Record<string, string>;
  /** localStorage 模式用（恢复当前 step） */
  currentIndex?: number;
  /** 防抖延迟（ms），默认 800（与现有新增页一致） */
  debounceMs?: number;
  /** 主开关，默认 true */
  enabled?: boolean;
}

export interface UseDiaryAutoSaveResult {
  status: AutoSaveStatus;
  /** 取消挂起防抖并立即保存（返回按钮 / 显式保存前调用） */
  flush: () => Promise<boolean>;
}

/**
 * 统一的日记自动保存 hook。
 *
 * 通过 `diaryId` 区分保存目标：
 * - 提供 diaryId → PATCH /api/diaries/[id] 云端更新（编辑页）
 * - 缺省 diaryId → localStorage 草稿（新增页，与原内联逻辑等价）
 *
 * 共享能力：
 * - 800ms 防抖（与新增页原行为一致）
 * - visibilitychange 守卫（PWA 切后台立即保存）
 * - beforeunload 守卫（关标签/杀进程时 keepalive 保存）
 * - flush() 用于显式触发（返回按钮 / 提交前）
 *
 * 重要：云端模式只 PATCH `content` + `module_labels_snapshot`，
 * 绝不触碰 `chat_history`，避免覆盖 AI 回响。
 */
export function useDiaryAutoSave({
  content,
  diaryId,
  labelsSnapshot,
  currentIndex,
  debounceMs = 800,
  enabled = true,
}: UseDiaryAutoSaveOptions): UseDiaryAutoSaveResult {
  const [status, setStatus] = useState<AutoSaveStatus>("idle");

  // Refs 避免事件处理器闭包陈旧
  const contentRef = useRef(content);
  const labelsRef = useRef(labelsSnapshot);
  const diaryIdRef = useRef(diaryId);
  const currentIndexRef = useRef(currentIndex);
  const enabledRef = useRef(enabled);

  useEffect(() => { contentRef.current = content; }, [content]);
  useEffect(() => { labelsRef.current = labelsSnapshot; }, [labelsSnapshot]);
  useEffect(() => { diaryIdRef.current = diaryId; }, [diaryId]);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setStatusSafe = useCallback((next: AutoSaveStatus) => {
    setStatus(next);
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    if (next === "saved") {
      statusTimerRef.current = setTimeout(() => setStatus("idle"), 2000);
    }
  }, []);

  const performSave = useCallback(
    async (useKeepalive: boolean): Promise<boolean> => {
      if (!enabledRef.current) return false;

      const currentContent = contentRef.current;
      const hasContent = Object.values(currentContent).some((v) => v && v.trim());
      if (!hasContent) return false;

      const currentDiaryId = diaryIdRef.current;

      if (currentDiaryId) {
        // 云端 PATCH
        setStatusSafe("saving");
        try {
          const res = await fetch(`/api/diaries/${currentDiaryId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              content: currentContent,
              labelsSnapshot: labelsRef.current,
            }),
            keepalive: useKeepalive,
          });
          if (res.ok) {
            setStatusSafe("saved");
            return true;
          }
          setStatusSafe("error");
          return false;
        } catch {
          setStatusSafe("error");
          return false;
        }
      }

      // localStorage 草稿（新增页）
      try {
        saveDraft(currentContent, currentIndexRef.current ?? 0);
        setStatusSafe("saved");
        return true;
      } catch {
        setStatusSafe("error");
        return false;
      }
    },
    [setStatusSafe]
  );

  // 防抖自动保存
  useEffect(() => {
    if (!enabled) return;
    if (Object.keys(content).length === 0) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void performSave(false);
    }, debounceMs);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [content, enabled, debounceMs, performSave]);

  // visibilitychange — PWA 切后台立即保存
  useEffect(() => {
    if (!enabled) return;
    const handler = () => {
      if (document.visibilityState === "hidden") {
        void performSave(false);
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [enabled, performSave]);

  // beforeunload — 关标签/杀进程时 keepalive 保存
  useEffect(() => {
    if (!enabled) return;
    const handler = () => {
      void performSave(true);
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [enabled, performSave]);

  // 卸载时清理 status timer
  useEffect(() => {
    return () => {
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    };
  }, []);

  const flush = useCallback(async (): Promise<boolean> => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    return performSave(false);
  }, [performSave]);

  return { status, flush };
}
