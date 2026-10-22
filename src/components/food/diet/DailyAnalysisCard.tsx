"use client";

import { useState } from "react";
import { Loader2, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { DayAnalysis } from "@/lib/nutrition-analysis";
import { NutrientRadarSection } from "@/components/food/analysis/NutrientRadarSection";

interface DailyAnalysisCardProps {
  selectedDate: string;
}

interface DayAnalysisResponse {
  success: boolean;
  analysis?: DayAnalysis;
  aiReport?: string;
  error?: string;
}

export function DailyAnalysisCard({ selectedDate }: DailyAnalysisCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState("");
  const [analysis, setAnalysis] = useState<DayAnalysis | null>(null);
  const [expanded, setExpanded] = useState(false);

  // 切日期清空结果（渲染期重置，避免 effect 内 setState 级联渲染）
  const [prevDate, setPrevDate] = useState(selectedDate);
  if (prevDate !== selectedDate) {
    setPrevDate(selectedDate);
    setReport("");
    setAnalysis(null);
    setError("");
    setExpanded(false);
  }

  const handleAnalyze = async () => {
    if (loading) return;

    if (expanded && report) {
      setExpanded(false);
      return;
    }

    if (report) {
      setExpanded(true);
      return;
    }

    setLoading(true);
    setError("");
    setExpanded(true);
    try {
      const res = await fetch("/api/diet-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selectedDate }),
      });
      const data = (await res.json().catch(() => null)) as DayAnalysisResponse | null;
      if (!res.ok || !data?.success || !data.aiReport) {
        setError(data?.error || "生成失败，请先添加食物记录");
        setReport("");
        setAnalysis(null);
      } else {
        setReport(data.aiReport);
        setAnalysis(data.analysis ?? null);
      }
    } catch {
      setError("网络错误，请稍后重试");
      setReport("");
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  };

  const hasReport = report.length > 0;
  const chevron = expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />;

  return (
    <div className="space-y-3">
      <button
        onClick={handleAnalyze}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-glow-gold/10 border border-glow-gold/30 text-glow-gold text-sm font-semibold disabled:opacity-50 hover:bg-glow-gold/20 active:scale-[0.98] transition-all"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {loading ? "分析中..." : hasReport ? (expanded ? "收起今日分析" : "展开今日分析") : "今日饮食分析"}
        {!loading && hasReport && chevron}
      </button>

      {expanded && (error || loading || hasReport) && (
        <div className="space-y-2">
          {analysis?.assessments && analysis.assessments.some((a) => a.has_data) && (
            <NutrientRadarSection assessments={analysis.assessments} />
          )}
          <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-3">
            {error && <p className="text-center text-xs text-rose-400/80">{error}</p>}
            {loading && !hasReport && (
              <div className="flex items-center justify-center py-8 gap-2 text-xs text-muted/50">
                <Loader2 className="h-4 w-4 animate-spin text-glow-gold/60" />
                正在分析今日饮食...
              </div>
            )}
            {hasReport && (
              <div className="prose-food-analysis">
                <Markdown remarkPlugins={[remarkGfm]}>{report}</Markdown>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
