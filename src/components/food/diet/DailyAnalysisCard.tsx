"use client";

import { useEffect, useState } from "react";
import { Loader2, Sparkles, ChevronDown, ChevronUp, RotateCw } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  generateDayAnalysis,
  loadDayAnalysis,
  peekDayAnalysis,
  type DayAnalysisResult,
} from "@/lib/day-analysis-client";

interface DailyAnalysisCardProps {
  selectedDate: string;
}

export function DailyAnalysisCard({ selectedDate }: DailyAnalysisCardProps) {
  const [result, setResult] = useState<DayAnalysisResult | null>(peekDayAnalysis(selectedDate));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);

  // 切日期：内存有就立刻显示，否则异步取（共享缓存，DietLogPanel 可能已经取过）
  const [prevDate, setPrevDate] = useState(selectedDate);
  if (prevDate !== selectedDate) {
    setPrevDate(selectedDate);
    setResult(peekDayAnalysis(selectedDate));
    setError("");
    setExpanded(false);
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    void loadDayAnalysis(selectedDate).then((r) => {
      if (!cancelled) setResult(r);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  const report = result?.aiReport ?? "";

  const handleAnalyze = () => {
    if (loading) return;
    if (report) {
      setExpanded((v) => !v);
      return;
    }
    void generate(false);
  };

  const generate = async (force: boolean) => {
    setLoading(true);
    setError("");
    setExpanded(true);
    const next = await generateDayAnalysis(selectedDate, force);
    setLoading(false);
    if (!next.aiReport) {
      setError("生成失败，请先添加食物记录");
      if (!force) setResult({ found: false, analysis: next.analysis, aiReport: null, generatedAt: null });
      return;
    }
    setResult(next);
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
        <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-3">
          {hasReport && (
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[11px] text-muted/50">
                {result?.generatedAt ? `生成于 ${formatTime(result.generatedAt)}` : ""}
              </span>
              <button
                onClick={() => void generate(true)}
                disabled={loading}
                className="inline-flex items-center gap-1 text-[11px] text-glow-gold/80 hover:text-glow-gold disabled:opacity-50 transition-colors"
              >
                <RotateCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
                重新生成
              </button>
            </div>
          )}
          {error && <p className="text-center text-xs text-rose-400/80">{error}</p>}
          {loading && !hasReport && (
            <div className="flex items-center justify-center py-8 gap-2 text-xs text-muted/60">
              <Loader2 className="h-4 w-4 animate-spin text-glow-gold/60" />
              正在分析今日饮食...
            </div>
          )}
          {hasReport && (
            <div className={`prose-food-analysis transition-opacity ${loading ? "opacity-40" : ""}`}>
              <Markdown remarkPlugins={[remarkGfm]}>{report}</Markdown>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** ISO → 月-日 时:分（本地时区展示） */
function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
