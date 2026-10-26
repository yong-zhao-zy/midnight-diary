"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useFoodStore } from "@/store/food-store";
import { createClient } from "@/lib/supabase/client";
import { todayShanghaiStr } from "@/lib/date-utils";
import { DietLogPanel } from "./diet/DietLogPanel";
import { BodyMetricPanel } from "./body/BodyMetricPanel";
import { RecipePanel } from "./recipe/RecipePanel";
import { HealthProfileSheet } from "./common/HealthProfileSheet";
import { HealthAnalysis } from "./analysis/HealthAnalysis";

export type FoodSubTab = "recipe" | "diet" | "body" | "analysis";

interface FoodHealthContainerProps {
  /** 受控：页签由统一头部（ModuleNav）渲染，这里只负责内容 */
  activeTab: FoodSubTab;
  onTabChange: (tab: FoodSubTab) => void;
  /** 健康画像面板开关：触发器在头部右侧，状态由页面持有 */
  profileOpen: boolean;
  onProfileOpenChange: (open: boolean) => void;
}

export function FoodHealthContainer({
  activeTab,
  onTabChange,
  profileOpen,
  onProfileOpenChange,
}: FoodHealthContainerProps) {
  const [selectedDate, setSelectedDate] = useState<string>(todayShanghaiStr());

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
    <div>
      <Tabs
        value={activeTab}
        onValueChange={(v) => onTabChange(v as FoodSubTab)}
        className="w-full"
      >
        <TabsContent value="recipe" forceMount className="data-[state=inactive]:hidden">
          <RecipePanel />
        </TabsContent>

        <TabsContent value="diet" forceMount className="data-[state=inactive]:hidden">
          <DietLogPanel
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        </TabsContent>

        <TabsContent value="body" forceMount className="data-[state=inactive]:hidden">
          <BodyMetricPanel
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        </TabsContent>

        <TabsContent value="analysis" forceMount className="data-[state=inactive]:hidden">
          <HealthAnalysis active={activeTab === "analysis"} />
        </TabsContent>
      </Tabs>

      <HealthProfileSheet open={profileOpen} onOpenChange={onProfileOpenChange} />
    </div>
  );
}
