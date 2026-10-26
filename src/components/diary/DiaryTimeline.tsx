"use client";

import { useMemo } from "react";
import { getDiaryDateStr, type DiaryRow } from "@/lib/diary-service";
import {
  type ModuleConfig,
  getPrefixedLabel,
  resolveDotColor,
  LEGACY_KEY_MAP,
} from "@/lib/module-config";
import { cn } from "@/lib/cn";

interface DiaryTimelineProps {
  entries: DiaryRow[];
  moduleConfig: ModuleConfig[];
  onSelect: (entry: DiaryRow) => void;
}

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function resolveContent(content: Record<string, string>, moduleId: string): string {
  if (content[moduleId]) return content[moduleId];
  for (const [legacyKey, newId] of Object.entries(LEGACY_KEY_MAP)) {
    if (newId === moduleId && content[legacyKey]) return content[legacyKey];
  }
  return "";
}

function parseLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function todayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function dayLabel(dateStr: string): { main: string; isToday: boolean } {
  const today = todayStr();
  if (dateStr === today) return { main: "今天", isToday: true };

  const y = new Date();
  y.setDate(y.getDate() - 1);
  const yestStr = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`;
  if (dateStr === yestStr) return { main: "昨天", isToday: false };

  const d = parseLocal(dateStr);
  return { main: `${d.getMonth() + 1}月${d.getDate()}日`, isToday: false };
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
    const value = resolveContent(content, mod.id);
    if (value?.trim()) {
      dims.push({ module: mod, text: value.trim(), idx });
      totalChars += value.trim().length;
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
 * 日记时间轴：按日期分组 + 按内容价值分级厚度。
 * 原来所有卡片等高等距，扫不出哪篇值得看，也看不出每天的断点。
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

  return (
    <div className="space-y-5">
      {groups.map(([dateStr, items]) => {
        const { main, isToday } = dayLabel(dateStr);
        const weekday = WEEKDAYS[parseLocal(dateStr).getDay()];

        return (
          <section key={dateStr}>
            <header className="mb-2 flex items-center gap-2">
              <h3 className={cn("text-[13px] font-medium", isToday ? "text-accent" : "text-ink/85")}>
                {main}
              </h3>
              <span className="text-[11px] text-ink-2/45">{weekday}</span>
              <span className="h-px flex-1 bg-line-1" />
              {items.length > 1 && (
                <span className="text-[11px] text-ink-2/40">{items.length} 条</span>
              )}
            </header>

            <div className="space-y-2">
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
                      className="flex cursor-pointer items-center gap-2.5 rounded-xl bg-surface-1 px-3.5 py-3 transition-all hover:bg-surface-2 active:scale-[0.99]"
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
                        {first.text.length} 字
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
                    </div>
                    <p className="line-clamp-2 text-[13px] leading-relaxed text-ink/80">
                      {first.text}
                    </p>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
