"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, LogOut, Loader2 } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { fetchDiaries, fetchDiaryDates, getTodayDiary, getDiaryCount, type DiaryRow } from "@/lib/diary-service";
import { ResponseLetter, DiaryDetail } from "@/components/diary/ResponseLetter";
import { DiaryFilters, type DateRange } from "@/components/diary/DiaryFilters";
import { DiaryCard } from "@/components/diary/DiaryCard";
import { IntroOverlay } from "@/components/IntroOverlay";
import { DiaryReport } from "@/components/report/DiaryReport";
import { NarrativeReport } from "@/components/narrative-report/NarrativeReport";
import { MySettings } from "@/components/my/MySettings";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DEFAULT_MODULE_CONFIG, type ModuleConfig, LEGACY_KEY_MAP } from "@/lib/module-config";
import type { CustomExpertTags } from "@/config/experts-config";

type TabKey = "write" | "overview" | "report" | "my";

export default function Home() {
  const router = useRouter();
  const [entries, setEntries] = useState<DiaryRow[]>([]);
  const [selected, setSelected] = useState<DiaryRow | null>(null);
  const [fabLoading, setFabLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("write");
  const [moduleConfig, setModuleConfig] = useState<ModuleConfig[]>(DEFAULT_MODULE_CONFIG);
  const [expertStyle, setExpertStyle] = useState("warm_companion");
  const [customExpertTags, setCustomExpertTags] = useState<CustomExpertTags | null>(null);

  // Filter state
  const [filterDateRange, setFilterDateRange] = useState<DateRange | undefined>(undefined);
  const [filterModule, setFilterModule] = useState<string | null>(null);
  const [diaryDates, setDiaryDates] = useState<string[]>([]);

  // Database-driven intro state: null = loading, true/false = resolved
  const [showIntro, setShowIntro] = useState<boolean | null>(null);

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Load user's profile settings
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("module_config, expert_style, custom_expert_tags")
          .eq("id", user.id)
          .single();

        if (profile?.module_config && Array.isArray(profile.module_config)) {
          setModuleConfig(profile.module_config as ModuleConfig[]);
        }
        if (profile?.expert_style) {
          setExpertStyle(profile.expert_style as string);
        }
        if (profile?.custom_expert_tags) {
          setCustomExpertTags(profile.custom_expert_tags as CustomExpertTags);
        }
      }

      const count = await getDiaryCount();
      setShowIntro(count === 0);
      const [data, dates] = await Promise.all([fetchDiaries(), fetchDiaryDates()]);
      setEntries(data);
      setDiaryDates(dates);
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
    setEntries((prev) =>
      prev.map((e) => (e.id === updated.id ? updated : e))
    );
    setSelected(updated);
  };

  const latestId = entries[0]?.id;

  // Derive whether any filter is active
  const hasFilter = !!filterDateRange?.from || !!filterModule;

  // Filter entries based on date range and/or module selection
  const filteredEntries = useMemo(() => {
    if (!hasFilter) return entries;

    return entries.filter((entry) => {
      // Date range filter
      if (filterDateRange?.from) {
        const entryDate = new Date(entry.created_at);
        const entryDateStr = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, "0")}-${String(entryDate.getDate()).padStart(2, "0")}`;
        const fromStr = `${filterDateRange.from.getFullYear()}-${String(filterDateRange.from.getMonth() + 1).padStart(2, "0")}-${String(filterDateRange.from.getDate()).padStart(2, "0")}`;
        const toDate = filterDateRange.to ?? filterDateRange.from;
        const toStr = `${toDate.getFullYear()}-${String(toDate.getMonth() + 1).padStart(2, "0")}-${String(toDate.getDate()).padStart(2, "0")}`;
        if (entryDateStr < fromStr || entryDateStr > toStr) return false;
      }

      // Module filter: entry must contain non-empty content for the selected module
      if (filterModule) {
        const content = entry.content as Record<string, string>;
        const directValue = content[filterModule];
        if (directValue && directValue.trim()) return true;
        // Check legacy keys
        for (const [legacyKey, newId] of Object.entries(LEGACY_KEY_MAP)) {
          if (newId === filterModule && content[legacyKey]?.trim()) return true;
        }
        return false;
      }

      return true;
    });
  }, [entries, filterDateRange, filterModule, hasFilter]);

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

          <TabsContent value="write" className="mt-6">
            {/* Filters - only show when there are entries */}
            {entries.length > 0 && (
              <DiaryFilters
                dateRange={filterDateRange}
                onDateRangeChange={setFilterDateRange}
                selectedModule={filterModule}
                onModuleChange={setFilterModule}
                moduleConfig={moduleConfig}
                diaryDates={diaryDates}
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
                      filterModule={filterModule}
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
            </div>
          </TabsContent>

          <TabsContent value="overview" className="mt-6">
            <DiaryReport />
          </TabsContent>

          <TabsContent value="report" className="mt-6">
            <NarrativeReport />
          </TabsContent>

          <TabsContent value="my" className="mt-6">
            <MySettings
              moduleConfig={moduleConfig}
              onModuleConfigChange={setModuleConfig}
              expertStyle={expertStyle}
              customExpertTags={customExpertTags}
              onExpertChange={(style, tags) => {
                setExpertStyle(style);
                setCustomExpertTags(tags);
              }}
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
