"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import {
  fetchDiariesInRange,
  createReport,
  updateReportTheme,
  updateReportContent,
  deleteReport,
  toggleReportShareStatus,
  type ReportRow,
  type ReportContent,
} from "@/lib/narrative-report-service";
import { getDiaryDateStr } from "@/lib/diary-service";
import { getActiveModules, type ModuleConfig, LEGACY_KEY_MAP } from "@/lib/module-config";
import type { CustomExpertTags } from "@/config/experts-config";
import { ReportListView } from "./ReportListView";
import { ReportDetailView } from "./ReportDetailView";
import { ReportLoadingAnimation } from "./ReportLoadingAnimation";
import { ReportListSkeleton } from "./ReportListSkeleton";
import { useDiaryStore } from "@/store/diary-store";

type ViewState = "list" | "generating" | "detail";

interface NarrativeReportProps {
  moduleConfig: ModuleConfig[];
  expertStyle: string;
  customExpertTags: CustomExpertTags | null;
}

export function NarrativeReport({
  moduleConfig,
  expertStyle,
  customExpertTags,
}: NarrativeReportProps) {
  const reports = useDiaryStore((s) => s.reports);
  const reportsFetchedAt = useDiaryStore((s) => s.reportsFetchedAt);
  const ensureReports = useDiaryStore((s) => s.ensureReports);
  const addReport = useDiaryStore((s) => s.addReport);
  const updateReport = useDiaryStore((s) => s.updateReport);
  const removeReport = useDiaryStore((s) => s.removeReport);
  const storeUserId = useDiaryStore((s) => s.userId);
  const storeEntries = useDiaryStore((s) => s.entries);

  const [viewState, setViewState] = useState<ViewState>("list");
  const [selectedReport, setSelectedReport] = useState<ReportRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Generation settings state (isolated from report viewing state)
  const [genSelectedModules, setGenSelectedModules] = useState<string[]>(() =>
    getActiveModules(moduleConfig).map((m) => m.id)
  );
  const [genShowHidden, setGenShowHidden] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch data on mount + when invalidated (fetchedAt → null)
  useEffect(() => {
    if (reportsFetchedAt === null) {
      ensureReports();
    }
  }, [reportsFetchedAt, ensureReports]);

  // Derive diaryDates from store entries (eliminates fetchDiaryDates query)
  const diaryDates = useMemo(
    () => storeEntries.map((e) => getDiaryDateStr(e)),
    [storeEntries]
  );

  // Build module name map from config (only for selected modules)
  const buildModuleNames = useCallback(
    (moduleIds: string[]): Record<string, string> => {
      const map: Record<string, string> = {};
      for (const mod of moduleConfig) {
        if (mod.isActive && moduleIds.includes(mod.id)) {
          map[mod.id] = mod.label;
        }
      }
      return map;
    },
    [moduleConfig]
  );

  // Filter diary content to only include selected modules
  const filterDiaryContent = useCallback(
    (content: Record<string, string>, moduleIds: string[]): Record<string, string> => {
      const filtered: Record<string, string> = {};
      for (const id of moduleIds) {
        const value = content[id];
        if (value && value.trim()) {
          filtered[id] = value;
        }
        // Check legacy keys
        for (const [legacyKey, newId] of Object.entries(LEGACY_KEY_MAP)) {
          if (newId === id && content[legacyKey]?.trim()) {
            filtered[id] = content[legacyKey];
          }
        }
      }
      return filtered;
    },
    []
  );

  // Generate report
  const handleGenerate = useCallback(
    async (startDate: string, endDate: string, moduleIds: string[]) => {
      if (!storeUserId) return;
      setError(null);
      setIsGenerating(true);
      setViewState("generating");

      try {
        // Fetch diaries in range
        const diaries = await fetchDiariesInRange(storeUserId, startDate, endDate);

        if (diaries.length === 0) {
          setError("这段时间没有日记记录，无法生成报告。");
          setViewState("list");
          return;
        }

        // Filter each diary's content to only selected modules
        const moduleNames = buildModuleNames(moduleIds);
        const diaryData = diaries.map((d) => ({
          date: d.created_at.slice(0, 10),
          content: filterDiaryContent(d.content as Record<string, string>, moduleIds),
        }));

        // Check if any diary has content after filtering
        const hasContent = diaryData.some((d) => Object.keys(d.content).length > 0);
        if (!hasContent) {
          setError("所选维度在这段时间内没有日记记录，无法生成报告。");
          setViewState("list");
          return;
        }

        // Call AI API
        const res = await fetch("/api/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            diaries: diaryData,
            moduleNames,
            startDate,
            endDate,
            expertStyle,
            customExpertTags,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || "报告生成失败");
        }

        const { content } = (await res.json()) as { content: ReportContent };

        // Inject metadata (selected modules + labels snapshot)
        content.selectedModuleIds = moduleIds;
        content.moduleLabelsSnapshot = Object.fromEntries(
          moduleIds.map((id) => [id, moduleConfig.find((m) => m.id === id)?.label ?? id])
        );
        content.allActiveModuleCount = getActiveModules(moduleConfig).length;

        // Save to database
        const saved = await createReport(storeUserId, startDate, endDate, content, expertStyle);

        if (saved) {
          addReport(saved);
          setSelectedReport(saved);
          setViewState("detail");
        } else {
          throw new Error("保存报告失败");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "报告生成失败，请稍后再试。");
        setViewState("list");
      } finally {
        setIsGenerating(false);
      }
    },
    [buildModuleNames, filterDiaryContent, moduleConfig, expertStyle, customExpertTags, storeUserId, addReport]
  );

  // Regenerate report
  const handleRegenerate = useCallback(
    async (report: ReportRow) => {
      if (!storeUserId) return;
      setViewState("generating");
      setIsGenerating(true);
      setError(null);

      try {
        // Use the original selected module IDs from the report metadata
        const moduleIds =
          report.content.selectedModuleIds ?? getActiveModules(moduleConfig).map((m) => m.id);

        const diaries = await fetchDiariesInRange(
          storeUserId,
          report.start_date,
          report.end_date
        );

        if (diaries.length === 0) {
          setError("这段时间没有日记记录，无法重新生成。");
          setViewState("detail");
          return;
        }

        const moduleNames = buildModuleNames(moduleIds);
        const diaryData = diaries.map((d) => ({
          date: d.created_at.slice(0, 10),
          content: filterDiaryContent(d.content as Record<string, string>, moduleIds),
        }));

        const res = await fetch("/api/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            diaries: diaryData,
            moduleNames,
            startDate: report.start_date,
            endDate: report.end_date,
            expertStyle,
            customExpertTags,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || "重新生成失败");
        }

        const { content } = (await res.json()) as { content: ReportContent };

        // Preserve metadata
        content.selectedModuleIds = moduleIds;
        content.moduleLabelsSnapshot = Object.fromEntries(
          moduleIds.map((id) => [id, moduleConfig.find((m) => m.id === id)?.label ?? id])
        );
        content.allActiveModuleCount = getActiveModules(moduleConfig).length;

        // Update existing report
        const success = await updateReportContent(report.id, content, expertStyle);

        if (success) {
          const updated: ReportRow = {
            ...report,
            theme: content.theme,
            content,
            expert_style: expertStyle,
          };
          updateReport(report.id, updated);
          setSelectedReport(updated);
          setViewState("detail");
        } else {
          throw new Error("更新报告失败");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "重新生成失败，请稍后再试。");
        setViewState("detail");
      } finally {
        setIsGenerating(false);
      }
    },
    [buildModuleNames, filterDiaryContent, moduleConfig, expertStyle, customExpertTags, storeUserId, updateReport]
  );

  // Rename theme
  const handleRename = useCallback(
    async (id: string, theme: string) => {
      const success = await updateReportTheme(id, theme);
      if (success) {
        updateReport(id, { theme });
      }
    },
    [updateReport]
  );

  // Delete report
  const handleDelete = useCallback(
    async (id: string) => {
      const success = await deleteReport(id);
      if (success) {
        removeReport(id);
      }
    },
    [removeReport]
  );

  // View report detail
  const handleView = useCallback((report: ReportRow) => {
    setSelectedReport(report);
    setViewState("detail");
  }, []);

  // Share report
  const handleShare = useCallback(
    async (report: ReportRow) => {
      const success = await toggleReportShareStatus(report.id, true);
      if (success) {
        updateReport(report.id, { is_public: true });
        const shareUrl = `${window.location.origin}/share/report/${report.id}`;
        try {
          await navigator.clipboard.writeText(shareUrl);
        } catch {
          // Fallback for older browsers
          const textarea = document.createElement("textarea");
          textarea.value = shareUrl;
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand("copy");
          document.body.removeChild(textarea);
        }
      }
    },
    [updateReport]
  );

  // Close detail
  const handleCloseDetail = useCallback(() => {
    setSelectedReport(null);
    setViewState("list");
  }, []);

  // Skeleton only on first load (data never fetched); keep stale data visible during re-fetch
  if (reportsFetchedAt === null && reports.length === 0) {
    return <ReportListSkeleton />;
  }

  return (
    <>
      {/* Error toast */}
      {error && (
        <div className="mb-4 px-4 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-sm text-rose-400 text-center">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-rose-400/60 hover:text-rose-400"
          >
            ✕
          </button>
        </div>
      )}

      {viewState === "list" && (
        <ReportListView
          reports={reports}
          diaryDates={diaryDates}
          moduleConfig={moduleConfig}
          selectedModules={genSelectedModules}
          onModulesChange={setGenSelectedModules}
          showHidden={genShowHidden}
          onShowHiddenChange={setGenShowHidden}
          isGenerating={isGenerating}
          onGenerate={handleGenerate}
          onView={handleView}
          onRename={handleRename}
          onDelete={handleDelete}
        />
      )}

      <AnimatePresence>
        {viewState === "detail" && selectedReport && (
          <ReportDetailView
            report={selectedReport}
            moduleConfig={moduleConfig}
            onClose={handleCloseDetail}
            onRegenerate={handleRegenerate}
            onShare={handleShare}
          />
        )}
      </AnimatePresence>

      {viewState === "generating" && <ReportLoadingAnimation />}
    </>
  );
}
