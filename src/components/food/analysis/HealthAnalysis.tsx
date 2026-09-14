"use client";

import { useState } from "react";
import { Loader2, BarChart3, Sparkles } from "lucide-react";
import { todayShanghaiStr, minusOneDay } from "@/lib/date-utils";
import { NUTRIENT_LABELS, type NutrientKey } from "@/config/dri-config";
import type { PeriodAnalysis, NutrientAssessment } from "@/lib/nutrition-analysis";
import { CalorieTrendChart } from "./CalorieTrendChart";
import { BodyTrendChart } from "./BodyTrendChart";
import { NutrientRadarChart } from "./NutrientRadarChart";

type RangeKey = "week" | "month";

function rangeFor(key: RangeKey): { start: string; end: string } {
  const end = todayShanghaiStr();
  const days = key === "week" ? 6 : 29;
  let start = end;
  for (let i = 0; i < days; i++) start = minusOneDay(start);
  return { start, end };
}

export function HealthAnalysis() {
  const [range, setRange] = useState<RangeKey>("week");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState<PeriodAnalysis | null>(null);
  const [advice, setAdvice] = useState("");

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    setAnalysis(null);
    setAdvice("");
    try {
      const { start, end } = rangeFor(range);
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

      {/* Range selector */}
      <div className="flex gap-2">
        {(["week", "month"] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`flex-1 py-2 rounded-xl text-xs transition-colors ${
              range === r
                ? "bg-glow-gold/90 text-midnight"
                : "bg-white/[0.03] border border-white/8 text-muted/70"
            }`}
          >
            {r === "week" ? "近 7 天" : "近 30 天"}
          </button>
        ))}
      </div>

      <button
        onClick={handleGenerate}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-glow-gold text-midnight text-sm font-semibold disabled:opacity-50 hover:bg-glow-gold/90 active:scale-[0.98] transition-all"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {loading ? "生成中..." : "生成报告"}
      </button>

      {error && <p className="text-center text-xs text-rose-400/80">{error}</p>}

      {analysis && (
        <div className="space-y-4">
          {/* Calorie trend */}
          <Section title="热量趋势" subtitle={`目标 ${analysis.calorie_trend[0]?.target ?? 0} kcal/天`}>
            <CalorieTrendChart data={analysis.calorie_trend} />
          </Section>

          {/* Nutrient radar */}
          <Section title="营养素达成率" subtitle="平均每日摄入 / DRI">
            <NutrientRadarChart assessments={analysis.assessments} />
          </Section>

          {/* Body trend */}
          <Section title="体重趋势">
            <BodyTrendChart data={analysis.body_weight_trend} />
            {analysis.body_metrics_change.weight_change != null && (
              <p className="text-xs text-muted/50 mt-1">
                周期变化 {formatChange(analysis.body_metrics_change.weight_change)} kg
              </p>
            )}
          </Section>

          {/* Nutrient list */}
          <Section title="营养素明细">
            <div className="space-y-1.5">
              {analysis.assessments.map((a) => (
                <NutrientRow key={a.key} a={a} />
              ))}
            </div>
          </Section>

          {/* AI advice */}
          {advice && (
            <Section title="AI 解读与建议">
              <div className="rounded-xl bg-glow-gold/[0.04] border border-glow-gold/15 p-3">
                <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">{advice}</p>
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

const RATING_LABELS: Record<string, string> = {
  sufficient: "充足",
  borderline: "临界",
  deficient: "不足",
  excessive: "过量",
};

const RATING_COLORS: Record<string, string> = {
  sufficient: "text-emerald-400/80",
  borderline: "text-amber-400/80",
  deficient: "text-rose-400/80",
  excessive: "text-rose-400/80",
};

function NutrientRow({ a }: { a: NutrientAssessment }) {
  const pct = Math.round(a.achievement_rate);
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted/70">{NUTRIENT_LABELS[a.key as NutrientKey]}</span>
      <span className="text-muted/40">
        {formatNum(a.intake)}/{formatNum(a.dri)} · {pct}%
      </span>
      <span className={`w-10 text-right ${RATING_COLORS[a.rating] ?? "text-muted/60"}`}>
        {RATING_LABELS[a.rating] ?? a.rating}
      </span>
    </div>
  );
}

function formatNum(n: number): string {
  return String(Math.round((Number(n) || 0) * 10) / 10);
}

function formatChange(n: number): string {
  const v = Math.round(n * 10) / 10;
  return v > 0 ? `+${v}` : `${v}`;
}
