"use client";

/**
 * AI 周期摘要缓存（period_summaries 的客户端镜像）。
 *
 * 只读不写：生成仍由 /api/period-summary 负责（带指纹，命中缓存不调 LLM）。
 * 概览表格从这里读周摘要；弹窗生成完成后回写这里，表格随即刷新。
 * 用户手写的周期摘要不在这个 store，见 summary-override-store。
 */

import { create } from "zustand";
import { fetchCachedPeriodSummaries } from "@/lib/period-summary-client";
import type { PeriodScope } from "@/lib/period-summary-service";

const STALE_MS = 5 * 60 * 1000;

/** `{ `${scope}:${periodKey}`: { [moduleId]: content } }` */
export type PeriodSummaryByKey = Record<string, Record<string, string>>;

export function periodSummaryKey(scope: PeriodScope, periodKey: string): string {
  return `${scope}:${periodKey}`;
}

interface PeriodSummaryState {
  byKey: PeriodSummaryByKey;
  scopeFetchedAt: Record<PeriodScope, number | null>;

  ensureScope: (scope: PeriodScope, force?: boolean) => Promise<void>;
  setSummaries: (
    scope: PeriodScope,
    periodKey: string,
    summaries: Record<string, string> | null
  ) => void;
  reset: () => void;
}

const inflight: Partial<Record<PeriodScope, Promise<void>>> = {};

export const usePeriodSummaryStore = create<PeriodSummaryState>((set, get) => ({
  byKey: {},
  scopeFetchedAt: { week: null, month: null },

  ensureScope: async (scope, force = false) => {
    const fetchedAt = get().scopeFetchedAt[scope];
    if (!force && fetchedAt && Date.now() - fetchedAt < STALE_MS) return;
    if (inflight[scope]) return inflight[scope];

    inflight[scope] = (async () => {
      try {
        const rows = await fetchCachedPeriodSummaries(scope);
        set((state) => {
          const next: PeriodSummaryByKey = {};
          // 只替换本 scope 的 key，保留另一 scope 的数据
          for (const [key, value] of Object.entries(state.byKey)) {
            if (!key.startsWith(`${scope}:`)) next[key] = value;
          }
          for (const row of rows) {
            const key = periodSummaryKey(scope, row.period_key);
            if (!next[key]) next[key] = {};
            next[key][row.module_id] = row.content;
          }
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

  setSummaries: (scope, periodKey, summaries) => {
    set((state) => {
      const key = periodSummaryKey(scope, periodKey);
      const next = { ...state.byKey };
      if (!summaries || Object.keys(summaries).length === 0) {
        delete next[key];
      } else {
        next[key] = { ...summaries };
      }
      return { byKey: next };
    });
  },

  reset: () => set({ byKey: {}, scopeFetchedAt: { week: null, month: null } }),
}));
