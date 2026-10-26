"use client";

import { useMemo } from "react";
import { getDiaryDateStr, type DiaryRow } from "@/lib/diary-service";
import {
  type ModuleConfig,
  getPrefixedLabel,
  resolveDotColor,
} from "@/lib/module-config";
import { resolveModuleContent } from "@/lib/diary-content";
import { cn } from "@/lib/cn";

interface DiaryTimelineProps {
  entries: DiaryRow[];
  moduleConfig: ModuleConfig[];
  onSelect: (entry: DiaryRow) => void;
}

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function parseLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function todayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

interface EntryDigest {
  dims: { module: ModuleConfig; text: string; idx: number }[];
  totalChars: number;
}

function digest(entry: DiaryRow, config: ModuleConfig[]): EntryDigest {
  const content = entry.content as Record<string, string>;
  const dims: { module: ModuleConfig; text: string; idx: number }[] = [];
  let totalChars = 0;

  config.forEach((mod, idx) => {
    const value = resolveModuleContent(content, mod.id);
    if (value) {
      dims.push({ module: mod, text: value, idx });
      totalChars += value.length;
    }
  });

  return { dims, totalChars };
}

/**
 * 内容价值分级：写得多 / 覆盖多个维度的日记给厚卡，其余降为一行薄卡。
 * 列表接口是轻量 select（不含 chat_history），所以用正文字数而不是「有没有 AI 回信」判断。
 */
function isRich({ dims, totalChars }: EntryDigest): boolean {
  return totalChars >= 100 || dims.length >= 3;
}

/**
 * 日记时间轴：左侧日期竖轨 + 右侧卡片，按内容价值分级厚度。
 * 日期从通栏小标题移到左侧竖轨后，同一天的多条记录共用同一个日期，
 * 时间连续感由竖线承担，卡片宽度也不再被日期行挤掉。
 */
export function DiaryTimeline({ entries, moduleConfig, onSelect }: DiaryTimelineProps) {
  const groups = useMemo(() => {
    const map = new Map<string, DiaryRow[]>();
    for (const entry of entries) {
      const key = getDiaryDateStr(entry);
      const bucket = map.get(key);
      if (bucket) bucket.push(entry);
      else map.set(key, [entry]);
    }
    return Array.from(map.entries());
  }, [entries]);

  const today = todayStr();

  return (
    <div>
      {groups.map(([dateStr, items], gi) => {
        const date = parseLocal(dateStr);
        const isToday = dateStr === today;
        const isLast = gi === groups.length - 1;
        const showMonth =
          gi === 0 || parseLocal(groups[gi - 1][0]).getMonth() !== date.getMonth();

        return (
          <div key={dateStr} className="flex gap-3">
            {/* 左侧日期竖轨 */}
            <div className="flex w-8 shrink-0 flex-col items-center">
              {showMonth && (
                <span className="mb-0.5 text-[10px] leading-none text-ink-2/40">
                  {date.getMonth() + 1} 月
                </span>
              )}
              <span
                className={cn(
                  "text-[15px] font-medium leading-tight",
                  isToday ? "text-accent" : "text-ink/85"
                )}
              >
                {date.getDate()}
              </span>
              <span className="mt-0.5 text-[10px] leading-tight text-ink-2/45">
                {isToday ? "今天" : WEEKDAYS[date.getDay()]}
              </span>
              {!isLast && <span className="mt-1.5 w-px flex-1 bg-line-1" aria-hidden />}
            </div>

            <div className={cn("min-w-0 flex-1 space-y-2", isLast ? "pb-1" : "pb-5")}>
              {items.map((entry) => {
                const d = digest(entry, moduleConfig);
                if (d.dims.length === 0) return null;
                const rich = isRich(d);
                const [first, ...rest] = d.dims;

                if (!rich) {
                  return (
                    <article
                      key={entry.id}
                      onClick={() => onSelect(entry)}
                      className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-line-1 bg-surface-1 px-3.5 py-3 transition-all hover:bg-surface-2 active:scale-[0.99]"
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 shrink-0 rounded-full",
                          resolveDotColor(first.module.id, first.idx)
                        )}
                      />
                      <p className="min-w-0 flex-1 truncate text-[13px] text-ink/75">
                        {first.text}
                      </p>
                      <span className="shrink-0 text-[11px] text-ink-2/40">
                        {d.totalChars} 字
                      </span>
                    </article>
                  );
                }

                return (
                  <article
                    key={entry.id}
                    onClick={() => onSelect(entry)}
                    className="cursor-pointer rounded-2xl border border-line-2 bg-surface-2 p-4 transition-all hover:border-accent/25 hover:bg-surface-3 active:scale-[0.99]"
                  >
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          resolveDotColor(first.module.id, first.idx)
                        )}
                      />
                      <span className="text-[11px] tracking-wide text-ink-2/65">
                        {getPrefixedLabel(first.module.label, first.idx)}
                      </span>
                      {rest.length > 0 && (
                        <span className="text-[11px] text-ink-2/35">
                          +{rest.length} 个维度
                        </span>
                      )}
                      <span className="ml-auto shrink-0 text-[11px] text-ink-2/40">
                        {d.totalChars} 字
                      </span>
                    </div>
                    <p className="line-clamp-2 text-[13px] leading-relaxed text-ink/80">
                      {first.text}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
