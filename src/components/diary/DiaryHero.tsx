"use client";

import { useMemo } from "react";
import { getDiaryDateStr, type DiaryRow } from "@/lib/diary-service";
import { toLocalDateStr } from "@/lib/diary-filter";
import { diaryCharCount } from "@/lib/diary-content";
import { type ModuleConfig } from "@/lib/module-config";
import { cn } from "@/lib/cn";

interface DiaryHeroProps {
  /** 已经过筛选的日记：统计条要反映「当前看到的这些」 */
  entries: DiaryRow[];
  moduleConfig: ModuleConfig[];
}

/**
 * 一行统计条（放在筛选行下方，先筛再看数）：
 * 「12 天 · 连续记录 / 本周 5 篇 · 平均 320 字」+ 最近 7 天足迹。
 * 连续天数 = 从最近一条记录日往前数，连续有记录的天数。
 */
export function DiaryHero({ entries, moduleConfig }: DiaryHeroProps) {
  const { streak, weekCount, avgChars, last7 } = useMemo(() => {
    const dateSet = new Set<string>();
    entries.forEach((e) => dateSet.add(getDiaryDateStr(e)));

    // 连续记录：从最近有记录的一天往前逐日回溯
    let streak = 0;
    if (dateSet.size > 0) {
      const latest = Array.from(dateSet).sort().pop()!;
      const cursor = new Date(`${latest}T00:00:00`);
      while (dateSet.has(toLocalDateStr(cursor))) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
      }
    }

    // 本周（周一起）
    const now = new Date();
    const monday = new Date(now);
    const dayIdx = (monday.getDay() + 6) % 7;
    monday.setDate(monday.getDate() - dayIdx);
    monday.setHours(0, 0, 0, 0);
    const mondayStr = toLocalDateStr(monday);
    const weekCount = entries.filter((e) => getDiaryDateStr(e) >= mondayStr).length;

    const totalChars = entries.reduce((sum, e) => sum + diaryCharCount(e, moduleConfig), 0);
    const avgChars = entries.length > 0 ? Math.round(totalChars / entries.length) : 0;

    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (6 - i));
      const key = toLocalDateStr(d);
      return { key, has: dateSet.has(key), isToday: i === 6 };
    });

    return { streak, weekCount, avgChars, last7 };
  }, [entries, moduleConfig]);

  return (
    <div className="mb-4 flex items-center gap-3 rounded-2xl border border-line-1 bg-surface-1 px-3.5 py-2.5">
      <div className="flex shrink-0 items-baseline gap-0.5">
        <span className="text-[22px] font-light leading-none text-ink/90">{streak}</span>
        <span className="text-[11px] text-ink-2/55">天</span>
      </div>

      <div className="min-w-0 flex-1 border-l border-line-1 pl-3">
        <p className="text-[11px] leading-tight text-ink-2/50">连续记录</p>
        <p className="mt-0.5 truncate text-xs text-ink-2/80">
          本周 {weekCount} 篇
          <span className="mx-1 text-ink-2/25">·</span>
          平均 {avgChars} 字
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
