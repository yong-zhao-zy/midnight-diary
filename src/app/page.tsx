"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Plus, LogOut, Loader2, WifiOff, Monitor, Smartphone, Shirt, Settings } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { isNetworkError } from "@/lib/supabase/errors";
import { getTodayDiary, getDiaryDateStr, type DiaryRow } from "@/lib/diary-service";
import { DiaryDetail } from "@/components/diary/ResponseLetter";
import { FilterBar } from "@/components/filters/FilterBar";
import { DiaryHero } from "@/components/diary/DiaryHero";
import { DiaryTimeline } from "@/components/diary/DiaryTimeline";
import { DiaryExportButton } from "@/components/diary/DiaryExportButton";
import { DiaryListSkeleton } from "@/components/diary/DiaryListSkeleton";
import { ModuleNav, type ModuleDef, type NavTab } from "@/components/nav/ModuleNav";
import { IntroOverlay } from "@/components/IntroOverlay";
import { MySettings } from "@/components/my/MySettings";
import { MinePage } from "@/components/mine/MinePage";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useDiaryStore } from "@/store/diary-store";
import { useInspirationStore } from "@/store/inspiration-store";
import { useFoodStore } from "@/store/food-store";
import { useSummaryOverrideStore } from "@/store/summary-override-store";
import { usePeriodSummaryStore } from "@/store/period-summary-store";
import { DEFAULT_MODULE_CONFIG, getActiveModules, type ModuleConfig } from "@/lib/module-config";
import { filterDiaries, hasActiveFilter } from "@/lib/diary-filter";
import { QUICK_RANGES } from "@/lib/date-presets";
import { type FoodSubTab } from "@/components/food/FoodHealthContainer";
import { useViewMode } from "@/lib/view-mode";
import { useTheme } from "@/lib/theme";
import type { DateRange } from "react-day-picker";
import type { CustomExpertTags } from "@/config/experts-config";

// Dynamic imports — code-split overview/report tabs out of the main bundle
const DiaryReport = dynamic(
  () => import("@/components/report/DiaryReport").then((m) => m.DiaryReport),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-accent/40" />
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
        <Loader2 className="h-6 w-6 animate-spin text-accent/40" />
      </div>
    ),
  }
);
const InspirationContainer = dynamic(
  () => import("@/components/inspiration/InspirationContainer").then((m) => m.InspirationContainer),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-accent/40" />
      </div>
    ),
  }
);
const FoodHealthContainer = dynamic(
  () => import("@/components/food/FoodHealthContainer").then((m) => m.FoodHealthContainer),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-accent/40" />
      </div>
    ),
  }
);

type TabKey = "write" | "overview" | "report" | "my" | "inspiration";
type ModuleKey = "diary" | "food" | "mine";
type MineSection = "theme" | "admin" | "account";

const MODULES: ModuleDef[] = [
  { key: "diary", label: "每日一记" },
  { key: "food", label: "每日好饭" },
  { key: "mine", label: "我的" },
];

// 数量与对象保持不变：一记 5 个、好饭 4 个，只是从胶囊换成了下划线页签
const DIARY_TABS: NavTab[] = [
  { key: "write", label: "写日记" },
  { key: "overview", label: "日记概览" },
  { key: "report", label: "日记报告" },
  { key: "my", label: "配置" },
  { key: "inspiration", label: "灵感" },
];

const FOOD_TABS: NavTab[] = [
  { key: "recipe", label: "菜谱" },
  { key: "diet", label: "饮食" },
  { key: "body", label: "身体" },
  { key: "analysis", label: "分析" },
];

/** 「我的」模块的页签；管理后台仅管理员可见（渲染时按角色过滤） */
const MINE_TABS: NavTab[] = [
  { key: "theme", label: "界面皮肤" },
  { key: "admin", label: "管理后台" },
  { key: "account", label: "账号设置" },
];

export default function Home() {
  const router = useRouter();
  const { isPC, toggle: toggleViewMode } = useViewMode();
  const { meta: themeMeta, cycle: cycleTheme } = useTheme();
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
  const inspirationPrefetchAll = useInspirationStore((s) => s.prefetchAll);
  const inspirationPrefetchIdle = useInspirationStore((s) => s.prefetchIdleData);
  const inspirationReset = useInspirationStore((s) => s.reset);
  const [selected, setSelected] = useState<DiaryRow | null>(null);
  const [fabLoading, setFabLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("write");
  const [activeModule, setActiveModule] = useState<ModuleKey>("diary");
  const [foodTab, setFoodTab] = useState<FoodSubTab>("diet");
  const [mineTab, setMineTab] = useState<MineSection>("theme");
  const [profileOpen, setProfileOpen] = useState(false);
  const [moduleConfig, setModuleConfig] = useState<ModuleConfig[]>(DEFAULT_MODULE_CONFIG);
  const [expertStyle, setExpertStyle] = useState("warm_companion");
  const [customExpertTags, setCustomExpertTags] = useState<CustomExpertTags | null>(null);
  const [userRole, setUserRole] = useState<"user" | "admin">("user");
  const [username, setUsername] = useState<string>("");
  // 数据加载失败（连不上 Supabase）时置 true。
  // 必须与「真的是空账号」区分开，否则会误显示成新账号，让人以为历史记录丢了。
  const [loadError, setLoadError] = useState(false);

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

  // Switch to the tab indicated by ?tab= on mount (e.g. returning from /diary?tab=inspiration).
  // useState initializer can't read window reliably because SSR renders "write" and hydration
  // preserves it; this effect runs after mount on the client.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "overview" || t === "report" || t === "my" || t === "inspiration") {
      // 微任务里再 setState：读的是外部状态（URL），且避免 effect 内同步 setState 的级联渲染
      queueMicrotask(() => setActiveTab(t));
    }
  }, []);

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
      // 注意：Supabase 不可达时数据层会返回空数组（不抛错），页面就会显示成「新账号」。
      // 这里单独记录失败标志，用来区分「加载失败」与「确实没有记录」。
      let loadFailed = false;
      const [profileResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("module_config, expert_style, custom_expert_tags, role, username")
          .eq("id", userId)
          .eq("is_deleted", false)
          .single(),
        prefetchAll(userId).catch(() => {
          loadFailed = true;
        }),
        inspirationPrefetchAll(userId).catch(() => {
          loadFailed = true;
        }),
      ]);

      if (isNetworkError(profileResult.error)) loadFailed = true;
      if (loadFailed) setLoadError(true);

      const profile = profileResult.data;
      const userConfig = (profile?.module_config && Array.isArray(profile.module_config)
        ? profile.module_config as ModuleConfig[]
        : DEFAULT_MODULE_CONFIG);
      setModuleConfig(userConfig);
      // Initialize filterModules to all active module IDs (no filter by default)
      setFilterModules(getActiveModules(userConfig).map(m => m.id));
      // 写日记页默认只看近 7 天。相对日期放到这里算（客户端），
      // 避免 SSR 用服务器时间算出的范围与客户端差一天，导致日期文案水合不一致。
      const weekPreset = QUICK_RANGES.find((q) => q.key === "7d");
      if (weekPreset) setFilterDateRange(weekPreset.build());
      if (profile?.expert_style) {
        setExpertStyle(profile.expert_style as string);
      }
      if (profile?.custom_expert_tags) {
        setCustomExpertTags(profile.custom_expert_tags as CustomExpertTags);
      }
      if (profile?.role === "admin") {
        setUserRole("admin");
      }
      if (profile?.username) {
        setUsername(profile.username as string);
      }

      // Derive showIntro from store entries (populated by prefetchAll)
      // 加载失败时不弹新手引导 —— 否则会被误认为「账号被清空了」
      setShowIntro(!loadFailed && useDiaryStore.getState().entries.length === 0);

      // Idle preload overview + report tab data (non-blocking)
      const doIdlePreload = () => {
        prefetchIdleData();
        inspirationPrefetchIdle();
      };
      if (typeof window !== "undefined" && "requestIdleCallback" in window) {
        // timeout 是硬上限：主线程再忙也必须在 3s 内执行，否则概览页只能等用户点进去才拉数
        requestIdleCallback(doIdlePreload, { timeout: 3000 });
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
    try {
      // 默认 global scope 需要请求后端；后端不可达时会抛错，把退出流程卡死。
      await supabase.auth.signOut();
    } catch {
      // 退化为只清本地 session，保证无论如何都能退出
      await supabase.auth.signOut({ scope: "local" }).catch(() => {});
    }
    resetStore();
    inspirationReset();
    useFoodStore.getState().reset();
    useSummaryOverrideStore.getState().reset();
    usePeriodSummaryStore.getState().reset();
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

  // 筛选判定统一走 lib/diary-filter —— 页面列表与底部筛选面板共用同一套逻辑，
  // 避免面板里算出的「查看 N 篇」和列表实际条数对不上。
  const activeModuleIds = useMemo(
    () => moduleConfig.filter((m) => m.isActive).map((m) => m.id),
    [moduleConfig]
  );
  const filterState = useMemo(
    () => ({ dateRange: filterDateRange, modules: filterModules }),
    [filterDateRange, filterModules]
  );
  const hasFilter = hasActiveFilter(filterState, activeModuleIds);
  const filteredEntries = useMemo(
    () => filterDiaries(entries, filterState, activeModuleIds),
    [entries, filterState, activeModuleIds]
  );

  // Loading state — prevent content flash before DB query resolves
  if (showIntro === null) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent/60" />
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-8">
      {/* 概览矩阵列多，PC 上放开宽度限制（其余页签保持 5xl 阅读宽度） */}
      <div
        className={`w-full space-y-6 ${
          isPC
            ? activeModule === "diary" && activeTab === "overview"
              ? "max-w-[1800px]"
              : "max-w-5xl"
            : "max-w-md"
        }`}
      >
        {/* 一级导航 = 模块大标题（可点击/左右滑动），二级 = 下划线页签 */}
        <ModuleNav
          modules={MODULES}
          activeModule={activeModule}
          onModuleChange={(k) => setActiveModule(k as ModuleKey)}
          tabs={
            activeModule === "diary"
              ? DIARY_TABS
              : activeModule === "food"
                ? FOOD_TABS
                : MINE_TABS.filter((t) => userRole === "admin" || t.key !== "admin")
          }
          activeTab={
            activeModule === "diary"
              ? activeTab
              : activeModule === "food"
                ? foodTab
                : mineTab
          }
          onTabChange={(k) => {
            if (activeModule === "diary") setActiveTab(k as TabKey);
            else if (activeModule === "food") setFoodTab(k as FoodSubTab);
            else setMineTab(k as MineSection);
          }}
          tabBarRight={
            activeModule === "food" ? (
              <button
                onClick={() => setProfileOpen(true)}
                className="p-1.5 rounded-lg text-ink-2/70 hover:text-accent hover:bg-surface-3 transition-colors"
                title="健康画像"
              >
                <Settings className="h-4 w-4" />
              </button>
            ) : undefined
          }
          titleRight={
            <>
              <button
                onClick={cycleTheme}
                className="p-2 rounded-lg text-ink-2 hover:text-ink hover:bg-surface-3 transition-colors"
                title={`当前皮肤：${themeMeta.name}（点击切换下一套）`}
              >
                <Shirt className="h-[18px] w-[18px]" />
              </button>
              <button
                onClick={toggleViewMode}
                className="p-2 rounded-lg text-ink-2 hover:text-ink hover:bg-surface-3 transition-colors"
                title={isPC ? "切换为手机模式" : "切换为 PC 模式"}
              >
                {isPC ? <Monitor className="h-[18px] w-[18px]" /> : <Smartphone className="h-[18px] w-[18px]" />}
              </button>
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg text-ink-2 hover:text-ink hover:bg-surface-3 transition-colors"
                title="退出登录"
              >
                <LogOut className="h-[18px] w-[18px]" />
              </button>
            </>
          }
        />

        {/* 数据加载失败提示 —— 不要把网络故障显示成「空账号」 */}
        {loadError && (
          <div className="flex items-start gap-2.5 rounded-xl border border-red-400/25 bg-red-400/[0.07] px-4 py-3">
            <WifiOff className="h-4 w-4 mt-0.5 shrink-0 text-red-400/80" />
            <div className="space-y-1.5">
              <p className="text-sm text-red-400/90">数据加载失败：连不上数据服务器</p>
              <p className="text-xs leading-relaxed text-ink-2/70">
                你的日记和饮食记录没有丢失，只是这次没取到。国内网络访问 Supabase 需要开启代理。
              </p>
              <button
                onClick={() => window.location.reload()}
                className="text-xs text-accent/80 hover:text-accent underline underline-offset-4"
              >
                重新加载
              </button>
            </div>
          </div>
        )}

        {/* 每日一记 module — diary tabs */}
        {activeModule === "diary" && (
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as TabKey)}
          className="w-full"
        >
          <TabsContent value="write" forceMount className="data-[state=inactive]:hidden">
            {entriesFetchedAt === null && entries.length === 0 ? (
              <DiaryListSkeleton />
            ) : (
              <>
                {/* 一条筛选框：日期收成图标，维度全部摊开 */}
                {entries.length > 0 && (
                  <FilterBar
                    dateRange={filterDateRange}
                    onDateRangeChange={setFilterDateRange}
                    selectedModules={filterModules}
                    onModulesChange={setFilterModules}
                    moduleConfig={moduleConfig}
                    activeModuleIds={activeModuleIds}
                    showHidden={filterShowHidden}
                    onShowHiddenChange={setFilterShowHidden}
                    diaryDates={diaryDates}
                    entries={entries}
                    action={<DiaryExportButton entries={allDiariesForExport} moduleConfig={moduleConfig} diaryDates={diaryDates} />}
                  />
                )}

                {/* 统计条在筛选下方：先筛，再看这批记录的连续天数/篇数/字数 */}
                {filteredEntries.length > 0 && (
                  <DiaryHero entries={filteredEntries} moduleConfig={moduleConfig} />
                )}

                {/* Empty state - no entries at all */}
                {!showIntro && entries.length === 0 && (
                  <div className="text-center py-20 space-y-3">
                    <p className="text-ink-2">还没有任何记录</p>
                    <p className="text-sm text-ink-2/70">点击下方按钮开始第一篇日记</p>
                  </div>
                )}

                {/* Empty state - filter yields no results */}
                {hasFilter && filteredEntries.length === 0 && entries.length > 0 && (
                  <div className="text-center py-16 space-y-3">
                    <p className="text-sm text-ink-2/80">这个范围内没有记录</p>
                    <p className="text-xs text-ink-2/60">换个日期或维度试试</p>
                  </div>
                )}

                {/* 时间轴：日期分组 + 厚薄分级 */}
                <DiaryTimeline
                  entries={filteredEntries}
                  moduleConfig={moduleConfig}
                  focusModules={filterModules}
                  activeModuleIds={activeModuleIds}
                  onSelect={setSelected}
                />

                {/* Load more — paginated fetch */}
                {entriesHasMore && (
                  <div className="flex justify-center pb-24">
                    <button
                      onClick={loadMoreEntries}
                      disabled={entriesLoadingMore}
                      className="flex items-center gap-2 px-5 py-2 rounded-full text-sm text-ink-2/70 hover:text-ink hover:bg-surface-3 transition-colors disabled:opacity-50"
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

                {/* 沉底写日记按钮留出的安全区 */}
                <div className="h-24" aria-hidden />
              </>
            )}
          </TabsContent>

          <TabsContent value="overview" forceMount className="data-[state=inactive]:hidden">
            <DiaryReport moduleConfig={moduleConfig} />
          </TabsContent>

          <TabsContent value="report" forceMount className="data-[state=inactive]:hidden">
            <NarrativeReport moduleConfig={moduleConfig} expertStyle={expertStyle} customExpertTags={customExpertTags} />
          </TabsContent>

          <TabsContent value="my" forceMount className="data-[state=inactive]:hidden">
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

          <TabsContent value="inspiration" forceMount className="data-[state=inactive]:hidden">
            <InspirationContainer />
          </TabsContent>
        </Tabs>
        )}

        {/* 每日好饭 module — food & health（页签由统一头部渲染） */}
        {activeModule === "food" && (
          <FoodHealthContainer
            activeTab={foodTab}
            onTabChange={setFoodTab}
            profileOpen={profileOpen}
            onProfileOpenChange={setProfileOpen}
          />
        )}

        {/* 一级模块「我的」：界面皮肤 / 管理后台 / 账号设置（管理后台仅管理员可见） */}
        {activeModule === "mine" && (
          <MinePage section={mineTab} username={username} />
        )}
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

      {/* 沉底「写今天的日记」——替代原来 fixed 到 viewport 右下角、会压住列表的 FAB */}
      {activeModule === "diary" && activeTab === "write" && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30">
          <div className="bg-gradient-to-t from-page via-page/90 to-transparent pt-10 pb-5">
            <div className={`mx-auto px-4 ${isPC ? "max-w-5xl" : "max-w-md"}`}>
              <button
                onClick={handleNewDiary}
                disabled={fabLoading}
                className={`pointer-events-auto flex h-12 items-center justify-center gap-2 rounded-full bg-accent text-sm font-medium text-accent-ink shadow-lg shadow-accent/20 transition-transform hover:scale-[1.01] active:scale-[0.98] disabled:opacity-60 ${
                  isPC ? "ml-auto w-60" : "w-full"
                }`}
              >
                {fabLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" strokeWidth={2.5} />
                )}
                写今天的日记
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
