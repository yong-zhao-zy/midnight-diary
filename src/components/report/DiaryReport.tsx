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
import { ReportFilters } from "./ReportFilters";
import { ReportTable } from "./ReportTable";

export function DiaryReport() {
  const [diaries, setDiaries] = useState<DiaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [granularity, setGranularity] = useState<Granularity>("week");
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [showHidden, setShowHidden] = useState(false);
  const [moduleConfig] = useState<ModuleConfig[]>(DEFAULT_MODULE_CONFIG);

  useEffect(() => {
    setGranularity(loadGranularity());
    setSelectedModules(loadSelectedModules());
    fetchDiariesForReport().then((data) => {
      setDiaries(data);
      setLoading(false);
    });
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
