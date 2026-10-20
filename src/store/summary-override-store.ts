"use client";

/**
 * 摘要覆盖层缓存（用户编辑的摘要）。
 *
 * 与 diary-store 分离：不碰日记数据，避免两个模块互相牵连。
 * 概览表格与弹窗都从这里读，读不到就是「没有编辑」，显示 AI 摘要。
 */

import { create } from "zustand";
import {
  fetchOverrides,
  overridesToMap,
  type OverrideByKey,
  type OverrideScope,
} from "@/lib/summary-override-service";

const STALE_MS = 5 * 60 * 1000;

interface SummaryOverrideState {
  byKey: OverrideByKey;
  scopeFetchedAt: Record<OverrideScope, number | null>;

  ensureScope: (scope: OverrideScope, force?: boolean) => Promise<void>;
  setContent: (
    scope: OverrideScope,
    periodKey: string,
    moduleId: string,
    content: string | null
  ) => void;
  reset: () => void;
}

// 同一 scope 的并发请求去重
const inflight: Partial<Record<OverrideScope, Promise<void>>> = {};

export const useSummaryOverrideStore = create<SummaryOverrideState>((set, get) => ({
  byKey: {},
  scopeFetchedAt: { day: null, week: null, month: null },

  ensureScope: async (scope, force = false) => {
    const fetchedAt = get().scopeFetchedAt[scope];
    if (!force && fetchedAt && Date.now() - fetchedAt < STALE_MS) return;
    if (inflight[scope]) return inflight[scope];

    inflight[scope] = (async () => {
      try {
        const rows = await fetchOverrides(scope);
        const incoming = overridesToMap(rows);
        // 只替换本 scope 的 key，保留其它 scope 已有数据
        set((state) => {
          const next: OverrideByKey = {};
          for (const [key, value] of Object.entries(state.byKey)) {
            if (!key.startsWith(`${scope}:`)) next[key] = value;
          }
          Object.assign(next, incoming);
          return {
            byKey: next,
            scopeFetchedAt: { ...state.scopeFetchedAt, [scope]: Date.now() },
          };
        });
      } finally {
        inflight[scope] = undefined;
      }
    })();

    return inflight[scope];
  },

  setContent: (scope, periodKey, moduleId, content) => {
    set((state) => {
      const key = `${scope}:${periodKey}`;
      const forPeriod = { ...(state.byKey[key] ?? {}) };
      if (content === null || !content.trim()) {
        delete forPeriod[moduleId];
      } else {
        forPeriod[moduleId] = content;
      }
      const next = { ...state.byKey };
      if (Object.keys(forPeriod).length === 0) {
        delete next[key];
      } else {
        next[key] = forPeriod;
      }
      return { byKey: next };
    });
  },

  reset: () =>
    set({
      byKey: {},
      scopeFetchedAt: { day: null, week: null, month: null },
    }),
}));
