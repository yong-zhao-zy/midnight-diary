"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Plus, LogOut, Loader2 } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { getTodayDiary, getDiaryDateStr, type DiaryRow } from "@/lib/diary-service";
import { ResponseLetter, DiaryDetail } from "@/components/diary/ResponseLetter";
import { DiaryFilters } from "@/components/diary/DiaryFilters";
import { DiaryCard } from "@/components/diary/DiaryCard";
import { DiaryExportButton } from "@/components/diary/DiaryExportButton";
import { DiaryListSkeleton } from "@/components/diary/DiaryListSkeleton";
import { IntroOverlay } from "@/components/IntroOverlay";
import { MySettings } from "@/components/my/MySettings";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useDiaryStore } from "@/store/diary-store";
import { DEFAULT_MODULE_CONFIG, getActiveModules, type ModuleConfig, LEGACY_KEY_MAP } from "@/lib/module-config";
import type { DateRange } from "react-day-picker";
import type { CustomExpertTags } from "@/config/experts-config";

// Dynamic imports — code-split overview/report tabs out of the main bundle
const DiaryReport = dynamic(
  () => import("@/components/report/DiaryReport").then((m) => m.DiaryReport),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-glow-gold/40" />
      </div>
    ),
  }
);
const NarrativeReport = dynamic(
  () => import("@/components/narrative-report/NarrativeReport").then((m) => m.NarrativeReport),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-glow-gold/40" />
      </div>
    ),
  }
);

type TabKey = "write" | "overview" | "report" | "my";

export default function Home() {
  const router = useRouter();
  const entries = useDiaryStore((s) => s.entries);
  const entriesFetchedAt = useDiaryStore((s) => s.entriesFetchedAt);
  const entriesHasMore = useDiaryStore((s) => s.entriesHasMore);
  const entriesLoadingMore = useDiaryStore((s) => s.entriesLoadingMore);
  const loadMoreEntries = useDiaryStore((s) => s.loadMoreEntries);
  const diariesForReport = useDiaryStore((s) => s.diariesForReport);
  const updateEntry = useDiaryStore((s) => s.updateEntry);
  const prefetchAll = useDiaryStore((s) => s.prefetchAll);
  const prefetchIdleData = useDiaryStore((s) => s.prefetchIdleData);
  const resetStore = useDiaryStore((s) => s.reset);
  const [selected, setSelected] = useState<DiaryRow | null>(null);
  const [fabLoading, setFabLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("write");
  const [moduleConfig, setModuleConfig] = useState<ModuleConfig[]>(DEFAULT_MODULE_CONFIG);
  const [expertStyle, setExpertStyle] = useState("warm_companion");
  const [customExpertTags, setCustomExpertTags] = useState<CustomExpertTags | null>(null);
  const [userRole, setUserRole] = useState<"user" | "admin">("user");

  // Filter state
  const [filterDateRange, setFilterDateRange] = useState<DateRange | undefined>(undefined);
  const [filterModules, setFilterModules] = useState<string[]>([]);
  const [filterShowHidden, setFilterShowHidden] = useState(false);

  // Derive diaryDates from entries + diariesForReport (idle-preloaded full list).
  // Before idle preload completes, only paginated entries contribute dates —
  // acceptable since the user is typically browsing recent dates.
  const diaryDates = useMemo(() => {
    const dates = new Set<string>();
    entries.forEach((e) => dates.add(getDiaryDateStr(e)));
    diariesForReport.forEach((d) => dates.add(getDiaryDateStr(d)));
    return Array.from(dates);
  }, [entries, diariesForReport]);

  // Database-driven intro state: null = loading, true/false = resolved
  const [showIntro, setShowIntro] = useState<boolean | null>(null);

  useEffect(() => {
    async function init() {
      const supabase = createClient();

      // Middleware already validated auth server-side (redirects to /login if unauthenticated).
      // getSession() is a local cookie read (no network) — use session.user.id directly.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        router.push("/login");
        return;
      }

      const userId = session.user.id;

      // Parallel: profile + all-tab data prefetch
      const [profileResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("module_config, expert_style, custom_expert_tags, role")
          .eq("id", userId)
          .single(),
        prefetchAll(userId),
      ]);

      const profile = profileResult.data;
      const userConfig = (profile?.module_config && Array.isArray(profile.module_config)
        ? profile.module_config as ModuleConfig[]
        : DEFAULT_MODULE_CONFIG);
      setModuleConfig(userConfig);
      // Initialize filterModules to all active module IDs (no filter by default)
      setFilterModules(getActiveModules(userConfig).map(m => m.id));
      if (profile?.expert_style) {
        setExpertStyle(profile.expert_style as string);
      }
      if (profile?.custom_expert_tags) {
        setCustomExpertTags(profile.custom_expert_tags as CustomExpertTags);
      }
      if (profile?.role === "admin") {
        setUserRole("admin");
      }

      // Derive showIntro from store entries (populated by prefetchAll)
      setShowIntro(useDiaryStore.getState().entries.length === 0);

      // Idle preload overview + report tab data (non-blocking)
      const doIdlePreload = () => prefetchIdleData();
      if (typeof window !== "undefined" && "requestIdleCallback" in window) {
        requestIdleCallback(doIdlePreload);
      } else {
        setTimeout(doIdlePreload, 2000);
      }

      // Pre-fetch guide questions silently (non-blocking, after profile is loaded)
      const modules = getActiveModules(
        (profile?.module_config as ModuleConfig[]) || DEFAULT_MODULE_CONFIG
      );
      const today = new Date().toISOString().slice(0, 10);
      const cacheKey = `guide_questions_${today}_${userId}`;
      const currentDimensions = modules.map((m) => m.label).sort();

      const cached = sessionStorage.getItem(cacheKey);
      let shouldFetch = true;
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          const cachedDims = (parsed.dimensions || []).sort();
          if (
            currentDimensions.length === cachedDims.length &&
            currentDimensions.every((d: string, i: number) => d === cachedDims[i])
          ) {
            shouldFetch = false;
          }
        } catch { /* re-fetch on corrupted cache */ }
      }

      if (shouldFetch) {
        fetch("/api/ai/guide-questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            modules: modules.map((m) => ({ id: m.id, label: m.label })),
          }),
        })
          .then((r) => r.ok ? r.json() : null)
          .then((data) => {
            if (data?.questions) {
              sessionStorage.setItem(
                cacheKey,
                JSON.stringify({ dimensions: currentDimensions, questions: data.questions })
              );
            }
          })
          .catch(() => {});
      }
    }

    init();
  }, []);

  useEffect(() => {
    if (selected) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [selected]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    resetStore();
    router.push("/login");
    router.refresh();
  };

  const handleNewDiary = async () => {
    if (fabLoading) return;
    setFabLoading(true);

    try {
      const existing = await getTodayDiary();
      if (existing) {
        router.push(`/write?id=${existing.id}`);
      } else {
        router.push("/write");
      }
    } catch {
      router.push("/write");
    } finally {
      setFabLoading(false);
    }
  };

  const handleIntroComplete = () => {
    setShowIntro(false);
  };

  const handleEntryUpdated = (updated: DiaryRow) => {
    updateEntry(updated);
    setSelected(updated);
  };

  const latestId = entries[0]?.id;

  // Merge entries + diariesForReport for export — ensures all diaries are
  // exportable even when entries is paginated (first 10 only).
  const allDiariesForExport = useMemo(() => {
    const map = new Map<string, DiaryRow>();
    entries.forEach((e) => map.set(e.id, e));
    diariesForReport.forEach((d) => map.set(d.id, d));
    return Array.from(map.values());
  }, [entries, diariesForReport]);

  // Derive whether any filter is active
  const activeModuleIds = moduleConfig.filter(m => m.isActive).map(m => m.id);
  const hasModuleFilter = filterModules.length > 0 && filterModules.length < activeModuleIds.length;
  const hasFilter = !!filterDateRange?.from || hasModuleFilter;

  // Filter entries based on date range and/or module selection
  const filteredEntries = useMemo(() => {
    if (!hasFilter) return entries;

    return entries.filter((entry) => {
      // Date range filter
      if (filterDateRange?.from) {
        const entryDateStr = getDiaryDateStr(entry);
        const fromStr = `${filterDateRange.from.getFullYear()}-${String(filterDateRange.from.getMonth() + 1).padStart(2, "0")}-${String(filterDateRange.from.getDate()).padStart(2, "0")}`;
        const toDate = filterDateRange.to ?? filterDateRange.from;
        const toStr = `${toDate.getFullYear()}-${String(toDate.getMonth() + 1).padStart(2, "0")}-${String(toDate.getDate()).padStart(2, "0")}`;
        if (entryDateStr < fromStr || entryDateStr > toStr) return false;
      }

      // Module filter: entry must contain non-empty content for at least one selected module
      if (hasModuleFilter) {
        const content = entry.content as Record<string, string>;
        const hasContent = filterModules.some(modId => {
          const directValue = content[modId];
          if (directValue && directValue.trim()) return true;
          // Check legacy keys
          for (const [legacyKey, newId] of Object.entries(LEGACY_KEY_MAP)) {
            if (newId === modId && content[legacyKey]?.trim()) return true;
          }
          return false;
        });
        if (!hasContent) return false;
      }

      return true;
    });
  }, [entries, filterDateRange, filterModules, hasModuleFilter, hasFilter]);

  // Loading state — prevent content flash before DB query resolves
  if (showIntro === null) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-glow-gold/60" />
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <header className="flex items-center justify-between pb-4">
          <div>
            <h1 className="text-2xl font-semibold text-glow-gold">深空回响</h1>
            <p className="text-sm text-muted">你的深夜回响</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-white/5 transition-colors"
            title="退出登录"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </header>

        {/* Tab switcher */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as TabKey)}
          className="w-full"
        >
          <TabsList className="w-full rounded-full bg-white/[0.04] border border-white/10 p-1 h-auto">
            <TabsTrigger
              value="write"
              className="flex-1 rounded-full px-3 py-2 text-sm font-medium data-[state=active]:bg-glow-gold/90 data-[state=active]:text-midnight data-[state=active]:shadow-none text-muted/70"
            >
              写日记
            </TabsTrigger>
            <TabsTrigger
              value="overview"
              className="flex-1 rounded-full px-3 py-2 text-sm font-medium data-[state=active]:bg-glow-gold/90 data-[state=active]:text-midnight data-[state=active]:shadow-none text-muted/70"
            >
              日记概览
            </TabsTrigger>
            <TabsTrigger
              value="report"
              className="flex-1 rounded-full px-3 py-2 text-sm font-medium data-[state=active]:bg-glow-gold/90 data-[state=active]:text-midnight data-[state=active]:shadow-none text-muted/70"
            >
              日记报告
            </TabsTrigger>
            <TabsTrigger
              value="my"
              className="flex-1 rounded-full px-3 py-2 text-sm font-medium data-[state=active]:bg-glow-gold/90 data-[state=active]:text-midnight data-[state=active]:shadow-none text-muted/70"
            >
              我的
            </TabsTrigger>
          </TabsList>

          <TabsContent value="write" forceMount className="mt-6 data-[state=inactive]:hidden">
            {entriesFetchedAt === null && entries.length === 0 ? (
              <DiaryListSkeleton />
            ) : (
              <>
                {/* Filters + Export - only show when there are entries */}
                {entries.length > 0 && (
                  <DiaryFilters
                    dateRange={filterDateRange}
                    onDateRangeChange={setFilterDateRange}
                    selectedModules={filterModules}
                    onModulesChange={setFilterModules}
                    moduleConfig={moduleConfig}
                    showHidden={filterShowHidden}
                    onShowHiddenChange={setFilterShowHidden}
                    diaryDates={diaryDates}
                    actionSlot={<DiaryExportButton entries={allDiariesForExport} moduleConfig={moduleConfig} diaryDates={diaryDates} />}
                  />
                )}

                {/* Empty state - no entries at all */}
                {!showIntro && entries.length === 0 && (
                  <div className="text-center py-20 space-y-3">
                    <p className="text-muted">还没有任何记录</p>
                    <p className="text-sm text-muted/60">点击右下角开始第一篇日记</p>
                  </div>
                )}

                {/* Empty state - filter yields no results */}
                {hasFilter && filteredEntries.length === 0 && entries.length > 0 && (
                  <div className="text-center py-16 space-y-3">
                    <p className="text-muted/80 text-sm">今天是一片安静的空白</p>
                    <p className="text-xs text-muted/50">去写一页吧...</p>
                  </div>
                )}

                {/* Diary list */}
                <div className="space-y-4 pb-24">
                  {hasFilter
                    ? filteredEntries.map((entry) => (
                        <DiaryCard
                          key={entry.id}
                          entry={entry}
                          moduleConfig={moduleConfig}
                          filterModules={hasModuleFilter ? filterModules : undefined}
                          expanded={!!filterDateRange?.from}
                          onClick={() => setSelected(entry)}
                        />
                      ))
                    : entries.map((entry) => (
                        <ResponseLetter
                          key={entry.id}
                          entry={entry}
                          moduleConfig={moduleConfig}
                          onClick={() => setSelected(entry)}
                        />
                      ))}

                  {/* Load more — paginated fetch */}
                  {entriesHasMore && (
                    <div className="flex justify-center pt-2">
                      <button
                        onClick={loadMoreEntries}
                        disabled={entriesLoadingMore}
                        className="flex items-center gap-2 px-5 py-2 rounded-full text-sm text-muted/70 hover:text-foreground hover:bg-white/5 transition-colors disabled:opacity-50"
                      >
                        {entriesLoadingMore ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            加载中...
                          </>
                        ) : (
                          "加载更多"
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="overview" forceMount className="mt-6 data-[state=inactive]:hidden">
            <DiaryReport moduleConfig={moduleConfig} />
          </TabsContent>

          <TabsContent value="report" forceMount className="mt-6 data-[state=inactive]:hidden">
            <NarrativeReport moduleConfig={moduleConfig} expertStyle={expertStyle} customExpertTags={customExpertTags} />
          </TabsContent>

          <TabsContent value="my" forceMount className="mt-6 data-[state=inactive]:hidden">
            <MySettings
              moduleConfig={moduleConfig}
              onModuleConfigChange={setModuleConfig}
              expertStyle={expertStyle}
              customExpertTags={customExpertTags}
              onExpertChange={(style, tags) => {
                setExpertStyle(style);
                setCustomExpertTags(tags);
              }}
              userRole={userRole}
            />
          </TabsContent>
        </Tabs>
      </div>

      <AnimatePresence>
        {selected && (
          <DiaryDetail
            entry={selected}
            isLatest={selected.id === latestId}
            onClose={() => setSelected(null)}
            onEntryUpdated={handleEntryUpdated}
            moduleConfig={moduleConfig}
            expertStyle={expertStyle}
            customExpertTags={customExpertTags}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showIntro && (
          <IntroOverlay onComplete={handleIntroComplete} />
        )}
      </AnimatePresence>

      {/* FAB with smart routing - only show on write tab */}
      {activeTab === "write" && (
        <button
          onClick={handleNewDiary}
          disabled={fabLoading}
          className="fixed bottom-8 right-8 flex h-14 w-14 items-center justify-center rounded-full bg-glow-gold shadow-lg shadow-glow-gold/25 text-midnight hover:scale-105 active:scale-95 disabled:hover:scale-100 transition-transform"
        >
          {fabLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Plus className="h-6 w-6" strokeWidth={2.5} />
          )}
        </button>
      )}
    </main>
  );
}
