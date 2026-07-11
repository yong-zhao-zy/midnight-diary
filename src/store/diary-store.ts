import { create } from "zustand";
import type { DiaryRow } from "@/lib/diary-service";
import { fetchDiaries } from "@/lib/diary-service";
import { fetchDiariesForReport } from "@/lib/report-service";
import type { ReportRow } from "@/lib/narrative-report-service";
import { fetchReports } from "@/lib/narrative-report-service";

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
        const data = await fetchDiariesForReport(userId);
        set({ diariesForReport: data, diariesForReportFetchedAt: Date.now() });
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
      userId: null,
      entriesHasMore: true,
      entriesOffset: 0,
      entriesLoadingMore: false,
    });
  },
}));
