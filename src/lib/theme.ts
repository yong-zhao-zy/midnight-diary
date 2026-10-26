"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * 全站皮肤（主题）系统。
 *
 * 设计原则：只换 CSS 变量（颜色/表面/边框），不改任何组件的结构与布局。
 * 新增皮肤 = 在 globals.css 加一段 [data-theme="xxx"] + 在下面 THEMES 里加一条。
 *
 * 与 view-mode.ts 同构：useSyncExternalStore 订阅外部状态（localStorage + storage 事件），
 * SSR 快照固定默认皮肤，首屏由 layout 里的内联脚本提前写入 data-theme 防闪。
 */

export type ThemeId = "space" | "doodle" | "kawaii";

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  desc: string;
  /** 预览色卡：底色 / 主色 / 文字色 */
  swatch: [string, string, string];
  /** 移动端浏览器地址栏配色 */
  themeColor: string;
}

export const THEMES: ThemeMeta[] = [
  {
    id: "space",
    name: "深空回响",
    desc: "靛蓝夜色 · 暖金",
    swatch: ["#020617", "#fde68a", "#f8fafc"],
    themeColor: "#020617",
  },
  {
    id: "doodle",
    name: "简笔清新",
    desc: "奶油纸底 · 陶土红",
    swatch: ["#fbf3ec", "#b4553a", "#3a3530"],
    themeColor: "#fbf3ec",
  },
  {
    id: "kawaii",
    name: "可爱鲜明",
    desc: "亮蓝底 · 奶油黄",
    swatch: ["#3a5fd9", "#ffd23f", "#fffaf0"],
    themeColor: "#3a5fd9",
  },
];

export const DEFAULT_THEME: ThemeId = "space";

const KEY = "diary-theme";

const listeners = new Set<() => void>();

function isThemeId(v: unknown): v is ThemeId {
  return v === "space" || v === "doodle" || v === "kawaii";
}

export function getStoredTheme(): ThemeId {
  try {
    const v = localStorage.getItem(KEY);
    return isThemeId(v) ? v : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/** 把主题写到 <html data-theme> 上，并同步移动端浏览器配色 */
export function applyTheme(id: ThemeId): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (root.dataset.theme !== id) {
    root.dataset.theme = id;
  }
  const meta = THEMES.find((t) => t.id === id);
  if (meta) {
    const tag = document.querySelector('meta[name="theme-color"]');
    if (tag) tag.setAttribute("content", meta.themeColor);
  }
}

export function setTheme(id: ThemeId): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* 隐私模式存不了：本次会话仍然生效 */
  }
  applyTheme(id);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      applyTheme(getStoredTheme());
      listeners.forEach((l) => l());
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): ThemeId {
  return getStoredTheme();
}

function getServerSnapshot(): ThemeId {
  return DEFAULT_THEME;
}

export function useTheme(): {
  theme: ThemeId;
  meta: ThemeMeta;
  setTheme: (id: ThemeId) => void;
  cycle: () => void;
} {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const change = useCallback((id: ThemeId) => setTheme(id), []);

  const cycle = useCallback(() => {
    const idx = THEMES.findIndex((t) => t.id === getStoredTheme());
    setTheme(THEMES[(idx + 1) % THEMES.length].id);
  }, []);

  return {
    theme,
    meta: THEMES.find((t) => t.id === theme) ?? THEMES[0],
    setTheme: change,
    cycle,
  };
}
