"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { DiaryRow } from "@/lib/diary-service";
import {
  type Granularity,
  fetchDiariesForReport,
  loadGranularity,
  saveGranularity,
  loadSelectedModules,
  saveSelectedModules,
} from "@/lib/report-service";
import { DEFAULT_MODULE_CONFIG, type ModuleConfig } from "@/lib/module-config";
import { createClient } from "@/lib/supabase/client";
import { ReportFilters } from "./ReportFilters";
import { ReportTable } from "./ReportTable";

export function DiaryReport() {
  const [diaries, setDiaries] = useState<DiaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [granularity, setGranularity] = useState<Granularity>("week");
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [showHidden, setShowHidden] = useState(false);
  const [moduleConfig, setModuleConfig] = useState<ModuleConfig[]>(DEFAULT_MODULE_CONFIG);

  useEffect(() => {
    async function init() {
      // Load user's module_config from profiles
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("module_config")
          .eq("id", user.id)
          .single();

        if (profile?.module_config && Array.isArray(profile.module_config)) {
          const userConfig = profile.module_config as ModuleConfig[];
          setModuleConfig(userConfig);

          // Initialize selectedModules with user's active module IDs
          const saved = loadSelectedModules();
          const activeIds = userConfig.filter((m) => m.isActive).map((m) => m.id);
          // Only use saved selection if it contains valid IDs from current config
          const validSaved = saved.filter((id) => userConfig.some((m) => m.id === id));
          setSelectedModules(validSaved.length > 0 ? validSaved : activeIds);
        } else {
          setSelectedModules(loadSelectedModules());
        }
      } else {
        setSelectedModules(loadSelectedModules());
      }

      setGranularity(loadGranularity());

      const data = await fetchDiariesForReport(user.id);
      setDiaries(data);
      setLoading(false);
    }

    init();
  }, []);

  const handleGranularityChange = (g: Granularity) => {
    setGranularity(g);
    saveGranularity(g);
  };

  const handleModulesChange = (modules: string[]) => {
    setSelectedModules(modules);
    saveSelectedModules(modules);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-glow-gold/60" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ReportFilters
        granularity={granularity}
        onGranularityChange={handleGranularityChange}
        selectedModules={selectedModules}
        onModulesChange={handleModulesChange}
        moduleConfig={moduleConfig}
        showHidden={showHidden}
        onShowHiddenChange={setShowHidden}
      />
      <ReportTable
        diaries={diaries}
        granularity={granularity}
        selectedModules={selectedModules}
        moduleConfig={moduleConfig}
        showHidden={showHidden}
      />
    </div>
  );
}
