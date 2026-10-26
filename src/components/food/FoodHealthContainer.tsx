"use client";

import { useEffect, useState } from "react";
import { UtensilsCrossed, Settings } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useFoodStore } from "@/store/food-store";
import { createClient } from "@/lib/supabase/client";
import { todayShanghaiStr } from "@/lib/date-utils";
import { DietLogPanel } from "./diet/DietLogPanel";
import { BodyMetricPanel } from "./body/BodyMetricPanel";
import { RecipePanel } from "./recipe/RecipePanel";
import { HealthProfileSheet } from "./common/HealthProfileSheet";
import { HealthAnalysis } from "./analysis/HealthAnalysis";

type FoodSubTab = "recipe" | "diet" | "body" | "analysis";

export function FoodHealthContainer() {
  const [activeSubTab, setActiveSubTab] = useState<FoodSubTab>("diet");
  const [selectedDate, setSelectedDate] = useState<string>(todayShanghaiStr());
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);

  const prefetchAll = useFoodStore((s) => s.prefetchAll);
  const ensureDietLogsForDate = useFoodStore((s) => s.ensureDietLogsForDate);
  const setHealthProfile = useFoodStore((s) => s.setHealthProfile);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mounted) return;

      prefetchAll(user.id);
      ensureDietLogsForDate(selectedDate);

      // Load health profile
      try {
        const res = await fetch("/api/health-profile");
        if (res.ok) {
          const data = await res.json();
          if (data?.healthProfile && mounted) {
            setHealthProfile(data.healthProfile);
          }
        }
      } catch { /* ignore */ }
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load diet logs whenever the selected date changes
  useEffect(() => {
    ensureDietLogsForDate(selectedDate);
  }, [selectedDate, ensureDietLogsForDate]);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <UtensilsCrossed className="h-4 w-4 text-accent/80" />
          <h2 className="text-base text-ink/80">每日好饭</h2>
        </div>
        <button
          onClick={() => setProfileSheetOpen(true)}
          className="p-2 rounded-lg text-ink-2/70 hover:text-accent hover:bg-surface-3 transition-colors"
          title="健康画像"
        >
          <Settings className="h-4 w-4" />
        </button>
      </header>

      <Tabs
        value={activeSubTab}
        onValueChange={(v) => setActiveSubTab(v as FoodSubTab)}
        className="w-full"
      >
        <TabsList className="w-full rounded-full bg-surface-2 border border-line-2 p-1 h-auto">
          <TabsTrigger value="recipe" className="flex-1 rounded-full px-2 py-2 text-xs font-medium data-[state=active]:bg-accent/90 data-[state=active]:text-accent-ink data-[state=active]:shadow-none text-ink-2/70">菜谱</TabsTrigger>
          <TabsTrigger value="diet" className="flex-1 rounded-full px-2 py-2 text-xs font-medium data-[state=active]:bg-accent/90 data-[state=active]:text-accent-ink data-[state=active]:shadow-none text-ink-2/70">饮食</TabsTrigger>
          <TabsTrigger value="body" className="flex-1 rounded-full px-2 py-2 text-xs font-medium data-[state=active]:bg-accent/90 data-[state=active]:text-accent-ink data-[state=active]:shadow-none text-ink-2/70">身体</TabsTrigger>
          <TabsTrigger value="analysis" className="flex-1 rounded-full px-2 py-2 text-xs font-medium data-[state=active]:bg-accent/90 data-[state=active]:text-accent-ink data-[state=active]:shadow-none text-ink-2/70">分析</TabsTrigger>
        </TabsList>

        <TabsContent value="recipe" forceMount className="mt-4 data-[state=inactive]:hidden">
          <RecipePanel />
        </TabsContent>

        <TabsContent value="diet" forceMount className="mt-4 data-[state=inactive]:hidden">
          <DietLogPanel
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        </TabsContent>

        <TabsContent value="body" forceMount className="mt-4 data-[state=inactive]:hidden">
          <BodyMetricPanel
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        </TabsContent>

        <TabsContent value="analysis" forceMount className="mt-4 data-[state=inactive]:hidden">
          <HealthAnalysis active={activeSubTab === "analysis"} />
        </TabsContent>
      </Tabs>

      <HealthProfileSheet open={profileSheetOpen} onOpenChange={setProfileSheetOpen} />
    </div>
  );
}
