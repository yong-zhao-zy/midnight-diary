"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * 全站视图模式：手机模式（448px 居中）/ PC 模式（896px 放宽）。
 * - 手动切换过 → 以 localStorage 为准；
 * - 没切换过 → 按屏幕宽度自动（≥1024px 视为 PC）。
 * 切换按钮始终显示，改的只是顶层容器宽度，全站（日记 + 好饭）同时生效。
 *
 * 用 useSyncExternalStore 订阅（localStorage + 窗口宽度都是外部状态），
 * 避免 effect 里 setState 的级联渲染问题；SSR 快照固定手机模式避免水合不一致。
 */

export type ViewMode = "mobile" | "pc";

const KEY = "diary-view-mode";

export function getStoredViewMode(): ViewMode | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "mobile" || v === "pc" ? v : null;
  } catch {
    return null;
  }
}

export function storeViewMode(mode: ViewMode): void {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    /* 隐私模式等存不了就算了，仅本次会话生效 */
  }
}

/** 手动设置过 → 用手动的；否则按屏幕宽度自动 */
export function effectiveViewMode(): ViewMode {
  const stored = getStoredViewMode();
  if (stored) return stored;
  return typeof window !== "undefined" && window.innerWidth >= 1024 ? "pc" : "mobile";
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("resize", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("resize", listener);
  };
}

function getSnapshot(): ViewMode {
  return effectiveViewMode();
}

function getServerSnapshot(): ViewMode {
  return "mobile";
}

function emitChange(): void {
  listeners.forEach((l) => l());
}

export function useViewMode(): { mode: ViewMode; isPC: boolean; toggle: () => void } {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback(() => {
    storeViewMode(effectiveViewMode() === "pc" ? "mobile" : "pc");
    emitChange();
  }, []);

  return { mode, isPC: mode === "pc", toggle };
}
