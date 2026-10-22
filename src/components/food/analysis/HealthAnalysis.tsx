"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, BarChart3, Sparkles, RotateCw } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { type PeriodAnalysis } from "@/lib/nutrition-analysis";
import { todayShanghaiStr } from "@/lib/date-utils";
import { DateRangePicker } from "@/components/diary/DateRangePicker";
import { CalorieTrendChart } from "./CalorieTrendChart";
import { NutrientRadarSection } from "./NutrientRadarSection";

function toDateStr(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

/** 当前自然周（周一 ~ 周日），日期字符串按上海时区取今天 */
function currentWeekRange(): DateRange {
  const [y, m, d] = todayShanghaiStr().split("-").map(Number);
  const today = new Date(y, m - 1, d);
  const offsetToMonday = (today.getDay() + 6) % 7; // 周日=0 → 6
  return {
    from: new Date(y, m - 1, d - offsetToMonday),
    to: new Date(y, m - 1, d - offsetToMonday + 6),
  };
}

interface HealthAnalysisProps {
  /** 只有切到【分析】tab 时才自动生成，避免应用启动就烧一次 LLM */
  active?: boolean;
}

export function HealthAnalysis({ active = true }: HealthAnalysisProps) {
  // 默认展示当前自然周
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => currentWeekRange());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState<PeriodAnalysis | null>(null);
  const [advice, setAdvice] = useState("");
  const [generatedAt, setGeneratedAt] = useState("");
  const [loadedKey, setLoadedKey] = useState("");

  const start = dateRange?.from ? toDateStr(dateRange.from) : "";
  const end = dateRange?.to ? toDateStr(dateRange.to) : "";
  const rangeKey = start && end ? `${start}_${end}` : "";

  // 请求序号：切范围后旧请求回来不覆盖新结果
  const seqRef = useRef(0);

  const generate = useCallback(
    async (force: boolean, silent = false) => {
      if (!start || !end) return;
      const seq = ++seqRef.current;
      setLoading(true);
      if (!silent) setError("");
      try {
        const res = await fetch("/api/health-analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startDate: start, endDate: end, force }),
        });
        const data = await res.json().catch(() => null);
        if (seq !== seqRef.current) return;
        if (!res.ok || !data?.analysis) {
          if (!silent) setError(data?.error || "生成失败，请先记录饮食和身体数据");
        } else {
          setAnalysis(data.analysis as PeriodAnalysis);
          setAdvice((data.aiAdvice as string) ?? "");
          setGeneratedAt((data.generatedAt as string) ?? "");
        }
      } catch {
        if (seq === seqRef.current && !silent) setError("网络错误，请稍后重试");
      } finally {
        if (seq === seqRef.current) setLoading(false);
      }
    },
    [start, end]
  );

  // 切 tab / 切范围：先读缓存（秒回），没有就自动生成一次
  useEffect(() => {
    if (!active || !rangeKey || rangeKey === loadedKey) return;

    const seq = ++seqRef.current;
    let cancelled = false;

    (async () => {
      setError("");
      setLoading(true);
      try {
        const res = await fetch(
          `/api/health-analysis?startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`
        );
        const data = await res.json().catch(() => null);
        if (cancelled || seq !== seqRef.current) return;

        setLoadedKey(rangeKey);
        if (data?.found && data.analysis) {
          setAnalysis(data.analysis as PeriodAnalysis);
          setAdvice((data.aiAdvice as string) ?? "");
          setGeneratedAt((data.generatedAt as string) ?? "");
          setLoading(false);
          return;
        }

        // 该范围还没有报告：清空旧结果并自动生成（默认展示当前自然周）
        setAnalysis(null);
        setAdvice("");
        setGeneratedAt("");
        void generate(false, true);
      } catch {
        if (cancelled || seq !== seqRef.current) return;
        setLoadedKey(rangeKey);
        setAnalysis(null);
        setAdvice("");
        setGeneratedAt("");
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [active, rangeKey, loadedKey, start, end, generate]);

  const hasReport = Boolean(analysis);

  // 清空日期范围：旧报告一并收起，避免显示「不属于当前范围」的结果
  const handleRangeChange = (range: DateRange | undefined) => {
    setDateRange(range);
    if (!range?.from || !range?.to) {
      setAnalysis(null);
      setAdvice("");
      setGeneratedAt("");
      setLoadedKey("");
      setError("");
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center gap-2 pb-1">
        <BarChart3 className="h-4 w-4 text-glow-gold/70" />
        <h3 className="text-sm text-foreground/80">健康分析报告</h3>
      </div>

      {/* Date range picker — 复用日记报告同款日历，默认当前自然周 */}
      <DateRangePicker
        dateRange={dateRange}
        onDateRangeChange={handleRangeChange}
      />

      <button
        onClick={() => void generate(hasReport)}
        disabled={loading || !start || !end}
        className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-glow-gold text-midnight text-sm font-semibold disabled:opacity-50 hover:bg-glow-gold/90 active:scale-[0.98] transition-all"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : hasReport ? <RotateCw className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
        {loading ? "生成中..." : hasReport ? "重新生成" : "生成报告"}
      </button>

      {error && <p className="text-center text-xs text-rose-400/80">{error}</p>}

      {loading && !hasReport && (
        <div className="flex items-center justify-center py-10 gap-2 text-xs text-muted/50">
          <Loader2 className="h-4 w-4 animate-spin text-glow-gold/60" />
          正在分析该周期饮食与身体数据...
        </div>
      )}

      {analysis && (
        <div className={`space-y-4 transition-opacity ${loading ? "opacity-40" : ""}`}>
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
            <Section title="AI 解读与建议" subtitle={generatedAt ? `生成于 ${formatTime(generatedAt)}` : undefined}>
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

/** ISO → 月-日 时:分（本地时区展示） */
function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
