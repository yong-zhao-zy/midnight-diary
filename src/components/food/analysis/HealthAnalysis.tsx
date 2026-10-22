"use client";

import { useState } from "react";
import { Loader2, BarChart3, Sparkles } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { type PeriodAnalysis } from "@/lib/nutrition-analysis";
import { DateRangePicker } from "@/components/diary/DateRangePicker";
import { CalorieTrendChart } from "./CalorieTrendChart";
import { NutrientRadarSection } from "./NutrientRadarSection";

function toDateStr(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function HealthAnalysis() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState<PeriodAnalysis | null>(null);
  const [advice, setAdvice] = useState("");

  const handleGenerate = async () => {
    if (!dateRange?.from || !dateRange?.to) {
      setError("请先选择日期范围");
      return;
    }
    setLoading(true);
    setError("");
    setAnalysis(null);
    setAdvice("");
    try {
      const start = toDateStr(dateRange.from);
      const end = toDateStr(dateRange.to);
      const res = await fetch("/api/health-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: start, endDate: end }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.analysis) {
        setError(data?.error || "生成失败，请先记录饮食和身体数据");
      } else {
        setAnalysis(data.analysis as PeriodAnalysis);
        setAdvice((data.aiAdvice as string) ?? "");
      }
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center gap-2 pb-1">
        <BarChart3 className="h-4 w-4 text-glow-gold/70" />
        <h3 className="text-sm text-foreground/80">健康分析报告</h3>
      </div>

      {/* Date range picker — 复用日记报告同款日历 */}
      <DateRangePicker
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
      />

      <button
        onClick={handleGenerate}
        disabled={loading || !dateRange?.from || !dateRange?.to}
        className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-glow-gold text-midnight text-sm font-semibold disabled:opacity-50 hover:bg-glow-gold/90 active:scale-[0.98] transition-all"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {loading ? "生成中..." : "生成报告"}
      </button>

      {error && <p className="text-center text-xs text-rose-400/80">{error}</p>}

      {analysis && (
        <div className="space-y-4">
          {/* 热量（左轴）+ 体重（右轴，可选）合并趋势 */}
          <Section title="热量与体重趋势" subtitle={`目标 ${analysis.calorie_trend[0]?.target ?? 0} kcal/天`}>
            <CalorieTrendChart data={analysis.calorie_trend} weightTrend={analysis.body_weight_trend} />
            {analysis.body_metrics_change.weight_change != null && (
              <p className="text-xs text-muted/50 mt-1">
                周期体重变化 {formatChange(analysis.body_metrics_change.weight_change)} kg
              </p>
            )}
          </Section>

          {/* 雷达布局：左大宏量，右上矿物质、右下维生素（纯 SVG，标签直出） */}
          <NutrientRadarSection assessments={analysis.assessments} />

          {/* AI advice */}
          {advice && (
            <Section title="AI 解读与建议">
              <div className="rounded-xl bg-glow-gold/[0.04] border border-glow-gold/15 p-3 prose-food-analysis">
                <Markdown remarkPlugins={[remarkGfm]}>{advice}</Markdown>
              </div>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-3">
      <div className="mb-2">
        <p className="text-sm text-foreground/80">{title}</p>
        {subtitle && <p className="text-xs text-muted/40">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function formatChange(n: number): string {
  const v = Math.round(n * 10) / 10;
  return v > 0 ? `+${v}` : `${v}`;
}
