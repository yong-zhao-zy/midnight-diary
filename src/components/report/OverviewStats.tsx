"use client";

import { useMemo, type ReactNode } from "react";
import { getDiaryDateStr, type DiaryRow } from "@/lib/diary-service";
import { getPeriodKey, parseDateKey } from "@/lib/period-summary-service";
import { type Granularity } from "@/lib/report-service";

interface OverviewStatsProps {
  /** 已按日期筛选的日记：摘要跟着当前看到的这段数据走 */
  entries: DiaryRow[];
  granularity: Granularity;
  /** 行尾操作区（下载按钮），原来是最近 7 天柱状图的位置 */
  action?: ReactNode;
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
 * 「4 周有记录 / 共 38 篇 · 密度 45%」+ 行尾一个导出入口。
 * 纯前端计算，不烧 token。
 */
export function OverviewStats({ entries, granularity, action }: OverviewStatsProps) {
  const { filled, unit, total, density } = useMemo(() => {
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

    return {
      filled: sortedPeriods.length,
      unit: granularity === "month" ? "月" : "周",
      total: entries.length,
      density: Math.round(Math.min(1, density) * 100),
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

      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
