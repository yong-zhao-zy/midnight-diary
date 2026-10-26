"use client";

import { useMemo } from "react";
import { getDiaryDateStr, type DiaryRow } from "@/lib/diary-service";
import { getPeriodKey, parseDateKey } from "@/lib/period-summary-service";
import { toLocalDateStr } from "@/lib/diary-filter";
import { type Granularity } from "@/lib/report-service";
import { cn } from "@/lib/cn";

interface OverviewStatsProps {
  /** 已按日期筛选的日记：摘要跟着当前看到的这段数据走 */
  entries: DiaryRow[];
  granularity: Granularity;
}

const WEEK_MS = 7 * 86400000;

/** 两个周 key（周一）之间跨了几周 */
function weekSpan(minKey: string, maxKey: string): number {
  const a = parseDateKey(minKey);
  const b = parseDateKey(maxKey);
  if (!a || !b) return 1;
  return Math.round((b.getTime() - a.getTime()) / WEEK_MS) + 1;
}

/** 两个 YYYY-MM 之间跨了几个月 */
function monthSpan(minKey: string, maxKey: string): number {
  const [y1, m1] = minKey.split("-").map(Number);
  const [y2, m2] = maxKey.split("-").map(Number);
  return Math.max(1, (y2 - y1) * 12 + (m2 - m1) + 1);
}

/**
 * 概览摘要条（与写日记页的统计条同构：先看摘要，再看矩阵）：
 * 「4 周有记录 / 共 38 篇 · 密度 45%」+ 最近 7 天足迹。
 * 纯前端计算，不烧 token。
 */
export function OverviewStats({ entries, granularity }: OverviewStatsProps) {
  const { filled, unit, total, density, last7 } = useMemo(() => {
    const dateSet = new Set<string>();
    const periodSet = new Set<string>();
    for (const e of entries) {
      const dateStr = getDiaryDateStr(e);
      dateSet.add(dateStr);
      const d = parseDateKey(dateStr);
      if (!d) continue;
      periodSet.add(
        granularity === "month" ? dateStr.slice(0, 7) : getPeriodKey("week", d)
      );
    }

    const sortedPeriods = Array.from(periodSet).sort();
    let density = 0;
    if (sortedPeriods.length > 0) {
      if (granularity === "day") {
        // 日模式：列 = 自然周，密度 = 有记录天数 / 覆盖天数
        density = dateSet.size / (sortedPeriods.length * 7);
      } else {
        const span =
          granularity === "week"
            ? weekSpan(sortedPeriods[0], sortedPeriods[sortedPeriods.length - 1])
            : monthSpan(sortedPeriods[0], sortedPeriods[sortedPeriods.length - 1]);
        density = sortedPeriods.length / span;
      }
    }

    const now = new Date();
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (6 - i));
      const key = toLocalDateStr(d);
      return { key, has: dateSet.has(key), isToday: i === 6 };
    });

    return {
      filled: sortedPeriods.length,
      unit: granularity === "month" ? "月" : "周",
      total: entries.length,
      density: Math.round(Math.min(1, density) * 100),
      last7,
    };
  }, [entries, granularity]);

  if (entries.length === 0) return null;

  return (
    <div className="mb-4 flex items-center gap-3 rounded-2xl border border-line-1 bg-surface-1 px-3.5 py-2.5">
      <div className="flex shrink-0 items-baseline gap-0.5">
        <span className="text-[22px] font-light leading-none text-ink/90">{filled}</span>
        <span className="text-[11px] text-ink-2/55">{unit}</span>
      </div>

      <div className="min-w-0 flex-1 border-l border-line-1 pl-3">
        <p className="text-[11px] leading-tight text-ink-2/50">有记录</p>
        <p className="mt-0.5 truncate text-xs text-ink-2/80">
          共 {total} 篇
          <span className="mx-1 text-ink-2/25">·</span>
          记录密度 {density}%
        </p>
      </div>

      <div className="flex shrink-0 items-end gap-[3px]" aria-hidden>
        {last7.map((d) => (
          <span
            key={d.key}
            title={`${d.key}${d.has ? " · 有记录" : ""}`}
            className={cn(
              "w-[6px] rounded-full transition-colors",
              d.has ? "h-4 bg-accent/75" : "h-[5px] bg-surface-5",
              d.isToday && "ring-1 ring-accent/40 ring-offset-1 ring-offset-transparent"
            )}
          />
        ))}
      </div>
    </div>
  );
}
