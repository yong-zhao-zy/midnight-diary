"use client";

import { useState } from "react";
import { Calendar } from "lucide-react";
import { useInspirationStore } from "@/store/inspiration-store";
import type { PracticeRow } from "@/lib/practice-service";
import { SourceBadge } from "../common/SourceBadge";
import { PracticeCalendarView } from "./PracticeCalendarView";

export function PracticeListForCalendar() {
  const practicesActive = useInspirationStore((s) => s.practicesActive);
  const practicesCompleted = useInspirationStore((s) => s.practicesCompleted);
  const [selected, setSelected] = useState<PracticeRow | null>(null);

  if (selected) {
    return <PracticeCalendarView practice={selected} onBack={() => setSelected(null)} />;
  }

  const allPractices = [...practicesActive, ...practicesCompleted];

  if (allPractices.length === 0) {
    return (
      <p className="text-center py-8 text-xs text-ink-2/50">
        暂无练习可查看
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-xs text-ink-2/60 px-1">选择练习查看打卡日历</h3>
      {allPractices.map((p) => (
        <button
          key={p.id}
          onClick={() => setSelected(p)}
          className="w-full text-left rounded-2xl border border-line-2 bg-surface-1 p-4 hover:border-accent/30 hover:bg-surface-2 transition-all flex items-center gap-3"
        >
          <Calendar className="h-4 w-4 text-ink-2/60 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className={`text-sm truncate ${p.status === "completed" ? "text-ink-2/70 line-through" : "text-ink/85"}`}>
              {p.title}
            </p>
            <div className="mt-1">
              <SourceBadge
                sourceType={p.source_type}
                sourceDiaryDate={p.source_diary_date}
              />
            </div>
          </div>
          {p.status === "completed" && (
            <span className="text-xs text-ink-2/50 shrink-0">已完结</span>
          )}
        </button>
      ))}
    </div>
  );
}
