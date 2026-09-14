"use client";

import { useEffect, useState } from "react";
import { UtensilsCrossed, Settings } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useFoodStore } from "@/store/food-store";
import { createClient } from "@/lib/supabase/client";
import { todayShanghaiStr, minusOneDay } from "@/lib/date-utils";
import { DailyOverview } from "./overview/DailyOverview";
import { DietLogPanel } from "./diet/DietLogPanel";
import { BodyMetricPanel } from "./body/BodyMetricPanel";
import { RecipePanel } from "./recipe/RecipePanel";
import { HealthProfileSheet } from "./common/HealthProfileSheet";
import { HealthAnalysis } from "./analysis/HealthAnalysis";

type FoodSubTab = "overview" | "diet" | "body" | "recipe" | "analysis";

export function FoodHealthContainer() {
  const [activeSubTab, setActiveSubTab] = useState<FoodSubTab>("overview");
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

  const shiftDate = (delta: number) => {
    let d = selectedDate;
    for (let i = 0; i < Math.abs(delta); i++) {
      d = delta < 0 ? minusOneDay(d) : plusOneDay(d);
    }
    setSelectedDate(d);
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <UtensilsCrossed className="h-4 w-4 text-glow-gold/80" />
          <h2 className="text-base text-foreground/80">每日好饭</h2>
        </div>
        <button
          onClick={() => setProfileSheetOpen(true)}
          className="p-2 rounded-lg text-muted/60 hover:text-glow-gold hover:bg-white/5 transition-colors"
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
        <TabsList className="w-full rounded-full bg-white/[0.04] border border-white/10 p-1 h-auto">
          <TabsTrigger value="overview" className="flex-1 rounded-full px-2 py-2 text-xs font-medium data-[state=active]:bg-glow-gold/90 data-[state=active]:text-midnight data-[state=active]:shadow-none text-muted/70">概览</TabsTrigger>
          <TabsTrigger value="diet" className="flex-1 rounded-full px-2 py-2 text-xs font-medium data-[state=active]:bg-glow-gold/90 data-[state=active]:text-midnight data-[state=active]:shadow-none text-muted/70">饮食</TabsTrigger>
          <TabsTrigger value="body" className="flex-1 rounded-full px-2 py-2 text-xs font-medium data-[state=active]:bg-glow-gold/90 data-[state=active]:text-midnight data-[state=active]:shadow-none text-muted/70">身体</TabsTrigger>
          <TabsTrigger value="recipe" className="flex-1 rounded-full px-2 py-2 text-xs font-medium data-[state=active]:bg-glow-gold/90 data-[state=active]:text-midnight data-[state=active]:shadow-none text-muted/70">菜谱</TabsTrigger>
          <TabsTrigger value="analysis" className="flex-1 rounded-full px-2 py-2 text-xs font-medium data-[state=active]:bg-glow-gold/90 data-[state=active]:text-midnight data-[state=active]:shadow-none text-muted/70">分析</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" forceMount className="mt-4 data-[state=inactive]:hidden">
          <DailyOverview
            selectedDate={selectedDate}
            onShiftDate={shiftDate}
            onJumpToDiet={() => setActiveSubTab("diet")}
          />
        </TabsContent>

        <TabsContent value="diet" forceMount className="mt-4 data-[state=inactive]:hidden">
          <DietLogPanel
            selectedDate={selectedDate}
            onShiftDate={shiftDate}
          />
        </TabsContent>

        <TabsContent value="body" forceMount className="mt-4 data-[state=inactive]:hidden">
          <BodyMetricPanel />
        </TabsContent>

        <TabsContent value="recipe" forceMount className="mt-4 data-[state=inactive]:hidden">
          <RecipePanel />
        </TabsContent>

        <TabsContent value="analysis" forceMount className="mt-4 data-[state=inactive]:hidden">
          <HealthAnalysis />
        </TabsContent>
      </Tabs>

      <HealthProfileSheet open={profileSheetOpen} onOpenChange={setProfileSheetOpen} />
    </div>
  );
}

function plusOneDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d + 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}
