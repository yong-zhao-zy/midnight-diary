"use client";

import type { DayAnalysis } from "@/lib/nutrition-analysis";

/**
 * 单日饮食分析的客户端缓存层（【饮食】Tab 专用）。
 * - 服务端那份（ai_analysis_reports 表）负责跨刷新/跨设备；
 * - 这层内存 Map 负责「来回切日期零延迟、零请求」。
 * DietLogPanel（四宫格雷达）与 DailyAnalysisCard（AI 报告）共用同一份。
 */

export interface DayAnalysisResult {
  /** true = 服务端有已封存的 AI 报告 */
  found: boolean;
  /** analyzeDay 确定性结果（雷达用），无记录时为 null */
  analysis: DayAnalysis | null;
  aiReport: string | null;
  generatedAt: string | null;
}

const EMPTY: DayAnalysisResult = { found: false, analysis: null, aiReport: null, generatedAt: null };

const cache = new Map<string, DayAnalysisResult>();
const inflight = new Map<string, Promise<DayAnalysisResult>>();

/** 同步取缓存（切日期渲染期用，不发起网络） */
export function peekDayAnalysis(date: string): DayAnalysisResult | null {
  return cache.get(date) ?? null;
}

/** 异步取：内存 → 服务端 GET（GET 未命中时服务端会顺带算好 analysis，不调 LLM） */
export function loadDayAnalysis(date: string): Promise<DayAnalysisResult> {
  const hit = cache.get(date);
  if (hit) return Promise.resolve(hit);

  const p = inflight.get(date);
  if (p) return p;

  const task = (async () => {
    try {
      const res = await fetch(`/api/diet-analysis?date=${encodeURIComponent(date)}`);
      if (!res.ok) return EMPTY;
      const data = await res.json().catch(() => null);
      const result: DayAnalysisResult = data
        ? {
            found: Boolean(data.found),
            analysis: data.analysis ?? null,
            aiReport: data.aiReport ?? null,
            generatedAt: data.generatedAt ?? null,
          }
        : EMPTY;
      cache.set(date, result);
      return result;
    } catch {
      return EMPTY;
    } finally {
      inflight.delete(date);
    }
  })();
  inflight.set(date, task);
  return task;
}

/** 只刷新 analysis（雷达用，?fresh=1 绕过服务端快照现算，不调 LLM）；AI 报告字段原样保留 */
export async function refreshDayAnalysis(date: string): Promise<DayAnalysisResult | null> {
  try {
    const res = await fetch(`/api/diet-analysis?date=${encodeURIComponent(date)}&fresh=1`);
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    if (!data) return null;
    const prev = cache.get(date);
    const next: DayAnalysisResult = {
      found: prev?.found ?? false,
      analysis: data.analysis ?? null,
      aiReport: prev?.aiReport ?? null,
      generatedAt: prev?.generatedAt ?? null,
    };
    cache.set(date, next);
    return next;
  } catch {
    return null;
  }
}

/** 生成 / 重新生成（POST），成功后写入缓存 */
export async function generateDayAnalysis(date: string, force: boolean): Promise<DayAnalysisResult> {
  try {
    const res = await fetch("/api/diet-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, force }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success) {
      return { ...EMPTY, found: false };
    }
    const result: DayAnalysisResult = {
      found: true,
      analysis: data.analysis ?? null,
      aiReport: data.aiReport ?? null,
      generatedAt: data.generatedAt ?? null,
    };
    cache.set(date, result);
    return result;
  } catch {
    return EMPTY;
  }
}
