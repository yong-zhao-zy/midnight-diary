import { create } from "zustand";
import type { DiaryRow } from "@/lib/diary-service";
import { fetchDiaries } from "@/lib/diary-service";
import { fetchDiariesForReport } from "@/lib/report-service";
import type { ReportRow } from "@/lib/narrative-report-service";
import { fetchReports } from "@/lib/narrative-report-service";
import { toFriendlyError } from "@/lib/supabase/errors";

const STALE_MS = 5 * 60 * 1000; // 5 minutes
const PAGE_SIZE = 10;

interface DiaryStoreState {
  // Data
  entries: DiaryRow[];
  diariesForReport: DiaryRow[];
  reports: ReportRow[];
  // Timestamps (null = never fetched → show skeleton)
  entriesFetchedAt: number | null;
  diariesForReportFetchedAt: number | null;
  reportsFetchedAt: number | null;
  /** 概览数据最近一次拉取失败的原因（null = 没有失败或还没拉过） */
  diariesForReportError: string | null;
  userId: string | null;

  // Pagination state for entries
  entriesHasMore: boolean;
  entriesOffset: number;
  entriesLoadingMore: boolean;

  // Prefetch / ensure
  prefetchAll: (userId: string) => Promise<void>;
  prefetchIdleData: () => void;
  ensureEntries: () => Promise<void>;
  ensureDiariesForReport: () => Promise<void>;
  ensureReports: () => Promise<void>;
  loadMoreEntries: () => Promise<void>;

  // Mutations
  updateEntry: (updated: DiaryRow) => void;
  invalidateDiaries: () => void;
  addReport: (report: ReportRow) => void;
  updateReport: (id: string, patch: Partial<ReportRow>) => void;
  removeReport: (id: string) => void;
  reset: () => void;
}

// Module-level in-flight promise tracking — deduplicates concurrent requests
let entriesPromise: Promise<void> | null = null;
let diariesForReportPromise: Promise<void> | null = null;
let reportsPromise: Promise<void> | null = null;

export const useDiaryStore = create<DiaryStoreState>((set, get) => ({
  entries: [],
  diariesForReport: [],
  reports: [],
  entriesFetchedAt: null,
  diariesForReportFetchedAt: null,
  reportsFetchedAt: null,
  diariesForReportError: null,
  userId: null,

  // Pagination state
  entriesHasMore: true,
  entriesOffset: 0,
  entriesLoadingMore: false,

  // First-screen: only fetch entries (first page). Overview/report deferred to idle preload.
  prefetchAll: async (userId) => {
    set({ userId });
    await get().ensureEntries();
  },

  // Idle preload: called via requestIdleCallback after first-screen entries are loaded.
  // Uses ensure* for in-flight deduplication + staleness checks.
  prefetchIdleData: () => {
    get().ensureDiariesForReport();
    get().ensureReports();
  },

  ensureEntries: async () => {
    const { userId, entriesFetchedAt } = get();
    if (!userId) return;
    if (entriesFetchedAt && Date.now() - entriesFetchedAt < STALE_MS) return;
    if (entriesPromise) return entriesPromise;
    entriesPromise = (async () => {
      try {
        const data = await fetchDiaries(userId, { limit: PAGE_SIZE, offset: 0 });
        set({
          entries: data,
          entriesFetchedAt: Date.now(),
          entriesOffset: data.length,
          entriesHasMore: data.length === PAGE_SIZE,
        });
      } finally {
        entriesPromise = null;
      }
    })();
    return entriesPromise;
  },

  ensureDiariesForReport: async () => {
    const { userId, diariesForReportFetchedAt } = get();
    if (!userId) return;
    if (diariesForReportFetchedAt && Date.now() - diariesForReportFetchedAt < STALE_MS) return;
    if (diariesForReportPromise) return diariesForReportPromise;
    diariesForReportPromise = (async () => {
      try {
        // 跨境链路抖动是常态（实测单次请求可能超时/RST），一次失败就展示空表太伤。
        // 重试 2 次（间隔 0.8s / 2.5s），单次尝试有 8s 硬超时（见 report-service），
        // 内部重试已在数据层关掉——所以最坏情况约 27 秒一定会有结论。
        // 仍失败则记下错误并保持 fetchedAt=null，下次进入概览会自动再试；UI 层同时给出重试按钮。
        const delays = [800, 2500];
        for (let attempt = 0; ; attempt++) {
          try {
            const data = await fetchDiariesForReport(userId);
            set({
              diariesForReport: data,
              diariesForReportFetchedAt: Date.now(),
              diariesForReportError: null,
            });
            return;
          } catch (err) {
            if (attempt >= delays.length) {
              set({ diariesForReportError: toFriendlyError(err) });
              return;
            }
            await new Promise((r) => setTimeout(r, delays[attempt]));
          }
        }
      } finally {
        diariesForReportPromise = null;
      }
    })();
    return diariesForReportPromise;
  },

  ensureReports: async () => {
    const { userId, reportsFetchedAt } = get();
    if (!userId) return;
    if (reportsFetchedAt && Date.now() - reportsFetchedAt < STALE_MS) return;
    if (reportsPromise) return reportsPromise;
    reportsPromise = (async () => {
      try {
        const data = await fetchReports(userId);
        set({ reports: data, reportsFetchedAt: Date.now() });
      } finally {
        reportsPromise = null;
      }
    })();
    return reportsPromise;
  },

  loadMoreEntries: async () => {
    const { userId, entriesOffset, entriesLoadingMore, entriesHasMore } = get();
    if (!userId || !entriesHasMore || entriesLoadingMore) return;

    set({ entriesLoadingMore: true });
    try {
      const data = await fetchDiaries(userId, {
        limit: PAGE_SIZE,
        offset: entriesOffset,
      });
      set((state) => ({
        entries: [...state.entries, ...data],
        entriesOffset: state.entriesOffset + data.length,
        entriesHasMore: data.length === PAGE_SIZE,
      }));
    } finally {
      set({ entriesLoadingMore: false });
    }
  },

  updateEntry: (updated) => {
    set((state) => ({
      entries: state.entries.map((e) => (e.id === updated.id ? updated : e)),
      diariesForReportFetchedAt: null,
    }));
  },

  invalidateDiaries: () => {
    set({
      entriesFetchedAt: null,
      diariesForReportFetchedAt: null,
      entriesHasMore: true,
      entriesOffset: 0,
    });
  },

  addReport: (report) => {
    set((state) => ({ reports: [report, ...state.reports] }));
  },

  updateReport: (id, patch) => {
    set((state) => ({
      reports: state.reports.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  },

  removeReport: (id) => {
    set((state) => ({
      reports: state.reports.filter((r) => r.id !== id),
    }));
  },

  reset: () => {
    set({
      entries: [],
      diariesForReport: [],
      reports: [],
      entriesFetchedAt: null,
      diariesForReportFetchedAt: null,
      reportsFetchedAt: null,
      diariesForReportError: null,
      userId: null,
      entriesHasMore: true,
      entriesOffset: 0,
      entriesLoadingMore: false,
    });
  },
}));
