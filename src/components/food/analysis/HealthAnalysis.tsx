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
import { NutrientOverviewGrid, macroLineFromAssessments } from "./NutrientOverviewGrid";

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

interface RangeEntry {
  analysis: PeriodAnalysis;
  aiAdvice: string;
  generatedAt: string;
}

/** 会话内内存缓存：同周期来回切换零请求（服务端快照负责跨刷新） */
const rangeCache = new Map<string, RangeEntry>();

interface HealthAnalysisProps {
  /** 只有切到【分析】tab 时才拉数据，避免应用启动就打接口 */
  active?: boolean;
}

export function HealthAnalysis({ active = true }: HealthAnalysisProps) {
  // 默认展示当前自然周
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => currentWeekRange());
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
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

  // 切 tab / 切范围：图表与四宫格自动展示（GET 现算或回放缓存，不调 LLM）；AI 文字另按按钮生成
  useEffect(() => {
    if (!active || !rangeKey || rangeKey === loadedKey) return;

    const seq = ++seqRef.current;
    let cancelled = false;

    (async () => {
      setError("");
      const hit = rangeCache.get(rangeKey);
      if (hit) {
        setAnalysis(hit.analysis);
        setAdvice(hit.aiAdvice);
        setGeneratedAt(hit.generatedAt);
        setLoadedKey(rangeKey);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(
          `/api/health-analysis?startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`
        );
        const data = await res.json().catch(() => null);
        if (cancelled || seq !== seqRef.current) return;

        setLoadedKey(rangeKey);
        if (data?.analysis) {
          const entry: RangeEntry = {
            analysis: data.analysis as PeriodAnalysis,
            aiAdvice: (data.aiAdvice as string) ?? "",
            generatedAt: (data.generatedAt as string) ?? "",
          };
          rangeCache.set(rangeKey, entry);
          setAnalysis(entry.analysis);
          setAdvice(entry.aiAdvice);
          setGeneratedAt(entry.generatedAt);
        } else {
          setAnalysis(null);
          setAdvice("");
          setGeneratedAt("");
        }
      } catch {
        if (cancelled || seq !== seqRef.current) return;
        setLoadedKey(rangeKey);
        setAnalysis(null);
        setAdvice("");
        setGeneratedAt("");
        setError("网络错误，请稍后重试");
      } finally {
        if (seq === seqRef.current && !cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [active, rangeKey, loadedKey, start, end]);

  const generateAdvice = useCallback(async () => {
    if (!start || !end) return;
    const seq = ++seqRef.current;
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/health-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: start, endDate: end, force: Boolean(advice) }),
      });
      const data = await res.json().catch(() => null);
      if (seq !== seqRef.current) return;
      if (!res.ok || !data?.analysis) {
        setError(data?.error || "生成失败，请先记录饮食和身体数据");
      } else {
        const entry: RangeEntry = {
          analysis: data.analysis as PeriodAnalysis,
          aiAdvice: (data.aiAdvice as string) ?? "",
          generatedAt: (data.generatedAt as string) ?? "",
        };
        if (entry.aiAdvice) rangeCache.set(rangeKey, entry);
        setAnalysis(entry.analysis);
        setAdvice(entry.aiAdvice);
        setGeneratedAt(entry.generatedAt);
      }
    } catch {
      if (seq === seqRef.current) setError("网络错误，请稍后重试");
    } finally {
      if (seq === seqRef.current) setGenerating(false);
    }
  }, [start, end, rangeKey, advice]);

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

  const hasAdvice = advice.length > 0;

  const generateButton = (
    <button
      onClick={() => void generateAdvice()}
      disabled={generating || !start || !end}
      className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-glow-gold text-midnight text-sm font-semibold disabled:opacity-50 hover:bg-glow-gold/90 active:scale-[0.98] transition-all"
    >
      {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : hasAdvice ? <RotateCw className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
      {generating ? "生成中..." : hasAdvice ? "重新生成" : "生成报告"}
    </button>
  );

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

      {/* 没有图表数据时按钮留在日期下方兜底；有数据时移到雷达图下方 */}
      {!analysis && generateButton}

      {error && <p className="text-center text-xs text-rose-400/80">{error}</p>}

      {loading && !analysis && (
        <div className="flex items-center justify-center py-10 gap-2 text-xs text-muted/60">
          <Loader2 className="h-4 w-4 animate-spin text-glow-gold/60" />
          正在统计该周期饮食与身体数据...
        </div>
      )}

      {analysis && (
        <div className={`space-y-4 transition-opacity ${loading || generating ? "opacity-40" : ""}`}>
          {/* 热量（左轴）+ 体重（右轴，可选）合并趋势 */}
          <Section title="热量与体重趋势" subtitle={`目标 ${analysis.calorie_trend[0]?.target ?? 0} kcal/天`}>
            <CalorieTrendChart data={analysis.calorie_trend} weightTrend={analysis.body_weight_trend} />
            {analysis.body_metrics_change.weight_change != null && (
              <p className="text-xs text-muted/60 mt-1">
                周期体重变化 {formatChange(analysis.body_metrics_change.weight_change)} kg
              </p>
            )}
          </Section>

          {/* 四宫格：日均热量环 + 三张达成率雷达（无需点按钮，自动展示） */}
          <NutrientOverviewGrid
            calorie={{
              targetKcal: analysis.calorie_trend[0]?.target ?? null,
              intakeKcal: analysis.avg_daily_nutrients.energy_kcal,
              intakeLabel: "日均摄入",
              macros: (["protein_g", "carb_g", "fat_g"] as const).map((key) =>
                macroLineFromAssessments(analysis.assessments, key)
              ),
            }}
            assessments={analysis.assessments}
          />

          {/* AI 文字报告入口：紧贴雷达图下方 */}
          {generateButton}

          {/* AI advice：点击「生成报告」后才出现 */}
          {(advice || generating) && (
            <Section title="AI 解读与建议" subtitle={generatedAt ? `生成于 ${formatTime(generatedAt)}` : undefined}>
              <div className="rounded-xl bg-glow-gold/[0.04] border border-glow-gold/15 p-3 prose-food-analysis">
                {generating && !advice ? (
                  <div className="flex items-center justify-center py-6 gap-2 text-xs text-muted/60">
                    <Loader2 className="h-4 w-4 animate-spin text-glow-gold/60" />
                    正在生成 AI 解读...
                  </div>
                ) : (
                  <Markdown remarkPlugins={[remarkGfm]}>{advice}</Markdown>
                )}
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
        {subtitle && <p className="text-xs text-muted/50">{subtitle}</p>}
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
