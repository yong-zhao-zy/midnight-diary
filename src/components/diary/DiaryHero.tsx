"use client";

import { useMemo } from "react";
import { getDiaryDateStr, type DiaryRow } from "@/lib/diary-service";
import { toLocalDateStr } from "@/lib/diary-filter";
import { cn } from "@/lib/cn";

interface DiaryHeroProps {
  entries: DiaryRow[];
}

/**
 * 一行统计条（替代原先占大半屏的欢迎语块）：
 * 「本月 12 天 · 本周 5 篇」+ 最近 7 天记录足迹。
 * 目的只有一个——把首屏让给日记列表本身。
 */
export function DiaryHero({ entries }: DiaryHeroProps) {
  const { monthDays, weekCount, last7 } = useMemo(() => {
    const dateSet = new Set<string>();
    entries.forEach((e) => dateSet.add(getDiaryDateStr(e)));

    const now = new Date();
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const monthDays = Array.from(dateSet).filter((d) => d.startsWith(monthPrefix)).length;

    // 本周一 00:00 起
    const monday = new Date(now);
    const dayIdx = (monday.getDay() + 6) % 7; // 0 = 周一
    monday.setDate(monday.getDate() - dayIdx);
    monday.setHours(0, 0, 0, 0);
    const mondayStr = toLocalDateStr(monday);
    const weekCount = entries.filter((e) => getDiaryDateStr(e) >= mondayStr).length;

    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (6 - i));
      const key = toLocalDateStr(d);
      return {
        key,
        has: dateSet.has(key),
        isToday: i === 6,
        label: `${d.getMonth() + 1}/${d.getDate()}`,
      };
    });

    return { monthDays, weekCount, last7 };
  }, [entries]);

  return (
    <div className="mb-4 flex items-center justify-between gap-4 rounded-2xl border border-line-1 bg-surface-1 px-4 py-2.5">
      <p className="text-xs text-ink-2/70">
        本月 <span className="font-medium text-ink/90">{monthDays}</span> 天
        <span className="mx-1.5 text-ink-2/25">·</span>
        本周 <span className="font-medium text-ink/90">{weekCount}</span> 篇
      </p>

      <div className="flex items-end gap-[3px]" aria-hidden>
        {last7.map((d) => (
          <span
            key={d.key}
            title={`${d.label}${d.has ? " · 有记录" : ""}`}
            className={cn(
              "w-[7px] rounded-full transition-colors",
              d.has ? "h-4 bg-accent/75" : "h-[5px] bg-surface-5",
              d.isToday && "ring-1 ring-accent/40 ring-offset-1 ring-offset-transparent"
            )}
          />
        ))}
      </div>
    </div>
  );
}
