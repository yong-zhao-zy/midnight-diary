"use client";

import { useEffect, useState, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchDiaryDates } from "@/lib/diary-service";
import {
  fetchReports,
  fetchDiariesInRange,
  createReport,
  updateReportTheme,
  updateReportContent,
  deleteReport,
  toggleReportShareStatus,
  type ReportRow,
  type ReportContent,
} from "@/lib/narrative-report-service";
import { DEFAULT_MODULE_CONFIG, type ModuleConfig } from "@/lib/module-config";
import type { CustomExpertTags } from "@/config/experts-config";
import { ReportListView } from "./ReportListView";
import { ReportDetailView } from "./ReportDetailView";
import { ReportLoadingAnimation } from "./ReportLoadingAnimation";

type ViewState = "list" | "generating" | "detail";

export function NarrativeReport() {
  const [viewState, setViewState] = useState<ViewState>("list");
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [selectedReport, setSelectedReport] = useState<ReportRow | null>(null);
  const [diaryDates, setDiaryDates] = useState<string[]>([]);
  const [moduleConfig, setModuleConfig] = useState<ModuleConfig[]>(DEFAULT_MODULE_CONFIG);
  const [expertStyle, setExpertStyle] = useState("warm_companion");
  const [customExpertTags, setCustomExpertTags] = useState<CustomExpertTags | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load initial data
  useEffect(() => {
    async function init() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        // Load module config + expert style
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

        // Load reports and diary dates in parallel
        const [reportsList, dates] = await Promise.all([
          fetchReports(),
          fetchDiaryDates(),
        ]);

        setReports(reportsList);
        setDiaryDates(dates);
      } catch (err) {
        console.error("NarrativeReport init error:", err);
      } finally {
        setLoading(false);
      }
    }

    init();
  }, []);

  // Build module name map from config
  const moduleNames = useCallback((): Record<string, string> => {
    const map: Record<string, string> = {};
    for (const mod of moduleConfig) {
      if (mod.isActive) {
        map[mod.id] = mod.label;
      }
    }
    return map;
  }, [moduleConfig]);

  // Generate report
  const handleGenerate = useCallback(
    async (startDate: string, endDate: string) => {
      setError(null);
      setViewState("generating");

      try {
        // Fetch diaries in range
        const diaries = await fetchDiariesInRange(startDate, endDate);

        if (diaries.length === 0) {
          setError("这段时间没有日记记录，无法生成报告。");
          setViewState("list");
          return;
        }

        // Prepare diary data for API
        const diaryData = diaries.map((d) => ({
          date: d.created_at.slice(0, 10),
          content: d.content as Record<string, string>,
        }));

        // Call AI API
        const res = await fetch("/api/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            diaries: diaryData,
            moduleNames: moduleNames(),
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

        // Save to database
        const saved = await createReport(startDate, endDate, content);

        if (saved) {
          setReports((prev) => [saved, ...prev]);
          setSelectedReport(saved);
          setViewState("detail");
        } else {
          throw new Error("保存报告失败");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "报告生成失败，请稍后再试。");
        setViewState("list");
      }
    },
    [moduleNames, expertStyle, customExpertTags]
  );

  // Regenerate report
  const handleRegenerate = useCallback(
    async (report: ReportRow) => {
      setViewState("generating");
      setError(null);

      try {
        const diaries = await fetchDiariesInRange(
          report.start_date,
          report.end_date
        );

        if (diaries.length === 0) {
          setError("这段时间没有日记记录，无法重新生成。");
          setViewState("detail");
          return;
        }

        const diaryData = diaries.map((d) => ({
          date: d.created_at.slice(0, 10),
          content: d.content as Record<string, string>,
        }));

        const res = await fetch("/api/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            diaries: diaryData,
            moduleNames: moduleNames(),
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

        // Update existing report
        const success = await updateReportContent(report.id, content);

        if (success) {
          const updated: ReportRow = {
            ...report,
            theme: content.theme,
            content,
          };
          setReports((prev) =>
            prev.map((r) => (r.id === report.id ? updated : r))
          );
          setSelectedReport(updated);
          setViewState("detail");
        } else {
          throw new Error("更新报告失败");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "重新生成失败，请稍后再试。");
        setViewState("detail");
      }
    },
    [moduleNames, expertStyle, customExpertTags]
  );

  // Rename theme
  const handleRename = useCallback(async (id: string, theme: string) => {
    const success = await updateReportTheme(id, theme);
    if (success) {
      setReports((prev) =>
        prev.map((r) => (r.id === id ? { ...r, theme } : r))
      );
    }
  }, []);

  // Delete report
  const handleDelete = useCallback(async (id: string) => {
    const success = await deleteReport(id);
    if (success) {
      setReports((prev) => prev.filter((r) => r.id !== id));
    }
  }, []);

  // View report detail
  const handleView = useCallback((report: ReportRow) => {
    setSelectedReport(report);
    setViewState("detail");
  }, []);

  // Share report
  const handleShare = useCallback(async (report: ReportRow) => {
    const success = await toggleReportShareStatus(report.id, true);
    if (success) {
      setReports((prev) =>
        prev.map((r) => (r.id === report.id ? { ...r, is_public: true } : r))
      );
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
  }, []);

  // Close detail
  const handleCloseDetail = useCallback(() => {
    setSelectedReport(null);
    setViewState("list");
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-glow-gold/60" />
      </div>
    );
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
          generating={false}
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
