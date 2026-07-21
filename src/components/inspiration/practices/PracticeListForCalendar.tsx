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
      <p className="text-center py-8 text-xs text-muted/40">
        暂无练习可查看
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-xs text-muted/50 px-1">选择练习查看打卡日历</h3>
      {allPractices.map((p) => (
        <button
          key={p.id}
          onClick={() => setSelected(p)}
          className="w-full text-left rounded-2xl border border-white/8 bg-white/[0.02] p-4 hover:border-glow-gold/30 hover:bg-white/[0.04] transition-all flex items-center gap-3"
        >
          <Calendar className="h-4 w-4 text-muted/50 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className={`text-sm truncate ${p.status === "completed" ? "text-muted/60 line-through" : "text-foreground/85"}`}>
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
            <span className="text-xs text-muted/40 shrink-0">已完结</span>
          )}
        </button>
      ))}
    </div>
  );
}
