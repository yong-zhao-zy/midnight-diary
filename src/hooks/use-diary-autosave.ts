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
  // Skip debounce on the very first render (content === initialContent, nothing changed)
  const isInitialRenderRef = useRef(true);

  // ─── Probe: mount/unmount + status changes ───
  useEffect(() => {
    console.log("[AutoSave] hook mounted", {
      diaryId: diaryId ?? "(undefined → localStorage mode)",
      hasContent: Object.values(content).some((v) => v && v.trim()),
      enabled,
      debounceMs,
    });
    return () => console.log("[AutoSave] hook unmounted");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setStatusSafe = useCallback((next: AutoSaveStatus) => {
    console.log("[AutoSave] status →", next);
    setStatus(next);
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    if (next === "saved") {
      statusTimerRef.current = setTimeout(() => setStatus("idle"), 2000);
    }
  }, []);

  const performSave = useCallback(
    async (useKeepalive: boolean): Promise<boolean> => {
      if (!enabledRef.current) {
        console.log("[AutoSave] performSave skipped — disabled");
        return false;
      }

      const currentContent = contentRef.current;
      const hasContent = Object.values(currentContent).some((v) => v && v.trim());
      if (!hasContent) {
        console.log("[AutoSave] performSave skipped — no content");
        return false;
      }

      const currentDiaryId = diaryIdRef.current;
      console.log("[AutoSave] performSave called", {
        diaryId: currentDiaryId ?? "(undefined → localStorage mode)",
        keepalive: useKeepalive,
        contentKeys: Object.keys(currentContent),
        contentPreview: JSON.stringify(currentContent).slice(0, 120),
      });

      if (currentDiaryId) {
        // 云端 PATCH
        setStatusSafe("saving");
        try {
          const url = `/api/diaries/${currentDiaryId}`;
          const body = JSON.stringify({
            content: currentContent,
            labelsSnapshot: labelsRef.current,
          });
          console.log("[AutoSave] sending PATCH", { url, bodyLength: body.length });
          const res = await fetch(url, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body,
            keepalive: useKeepalive,
          });
          console.log("[AutoSave] PATCH response", { ok: res.ok, status: res.status });
          if (res.ok) {
            setStatusSafe("saved");
            return true;
          }
          // Log error body for diagnosis
          try {
            const errBody = await res.json();
            console.log("[AutoSave] PATCH error body", errBody);
          } catch {
            // ignore JSON parse failure
          }
          setStatusSafe("error");
          return false;
        } catch (err) {
          console.log("[AutoSave] PATCH exception", err);
          setStatusSafe("error");
          return false;
        }
      }

      // localStorage 草稿（新增页）
      try {
        saveDraft(currentContent, currentIndexRef.current ?? 0);
        setStatusSafe("saved");
        return true;
      } catch (err) {
        console.log("[AutoSave] localStorage save exception", err);
        setStatusSafe("error");
        return false;
      }
    },
    [setStatusSafe]
  );

  // 卸载保护：组件卸载时（如关闭抽屉绕过取消按钮）立即 keepalive 保存
  // 必须放在防抖 effect 前面，确保 cleanup 先于防抖 cleanup 执行，
  // 此时 debounceRef.current 仍指向待发的计时器。
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
        console.log("[AutoSave] unmount with pending debounce → keepalive save");
        void performSave(true);
      }
    };
  }, [performSave]);

  // 防抖自动保存
  useEffect(() => {
    // 跳过首次挂载：content === initialContent，用户尚未修改任何内容
    if (isInitialRenderRef.current) {
      isInitialRenderRef.current = false;
      return;
    }

    if (!enabled) return;
    if (Object.keys(content).length === 0) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    console.log("[AutoSave] debounce timer set", {
      debounceMs,
      contentKeys: Object.keys(content),
      diaryId: diaryId ?? "(undefined → localStorage mode)",
    });
    debounceRef.current = setTimeout(() => {
      console.log("[AutoSave] debounce fired → calling performSave");
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
