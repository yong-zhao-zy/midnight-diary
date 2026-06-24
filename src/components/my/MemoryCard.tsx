"use client";

import { useEffect, useState } from "react";
import { Brain, Circle } from "lucide-react";
import { fetchUserMemory, type MemoryProfile, type ActiveEvent } from "@/lib/memory-service";

function StatusBadge({ status }: { status: ActiveEvent["status"] }) {
  const config = {
    ongoing: { label: "进行中", cls: "bg-glow-gold/20 text-glow-gold" },
    resolved_partially: { label: "部分解决", cls: "bg-amber-500/20 text-amber-400" },
    resolved: { label: "已解决", cls: "bg-green-500/20 text-green-400" },
  };
  const { label, cls } = config[status] ?? config.ongoing;
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

export function MemoryCard() {
  const [memory, setMemory] = useState<MemoryProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserMemory()
      .then(setMemory)
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-center gap-2 mb-4">
        <Brain className="h-4 w-4 text-glow-gold/70" />
        <h2 className="text-sm font-medium text-foreground/90">
          AI 的活跃记忆
        </h2>
      </div>

      {loading ? (
        <div className="py-4 text-center text-xs text-muted/50">加载中...</div>
      ) : !memory ? (
        <div className="py-4 text-center text-xs text-muted/50">
          AI 尚未建立你的记忆档案，写完首篇日记后自动生成。
        </div>
      ) : (
        <div className="space-y-4">
          {/* Mental Baseline */}
          {memory.mental_baseline && (
            <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
              <p className="text-[11px] text-muted/50 mb-1">心智基线</p>
              <p className="text-xs text-foreground/80 leading-relaxed">
                {memory.mental_baseline}
              </p>
            </div>
          )}

          {/* Active Events Timeline */}
          {memory.active_events.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] text-muted/50">活跃事件线</p>
              {memory.active_events.map((event) => (
                <div
                  key={event.event_id}
                  className="relative pl-4 rounded-xl border border-white/8 bg-white/[0.02] p-3"
                >
                  <Circle className="absolute left-1.5 top-4 h-2 w-2 fill-glow-gold/60 text-glow-gold/60" />
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-xs font-medium text-foreground/85 flex-1">
                      {event.summary}
                    </p>
                    <StatusBadge status={event.status} />
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted/50">
                    {event.key_stakeholders && (
                      <span>干系人：{event.key_stakeholders}</span>
                    )}
                    <span>{event.created_at}</span>
                  </div>
                  {event.user_cognitive_shift && (
                    <p className="mt-1.5 text-[11px] text-foreground/60 leading-relaxed">
                      {event.user_cognitive_shift}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Recurring Patterns */}
          {memory.recurring_patterns.length > 0 && (
            <div>
              <p className="text-[11px] text-muted/50 mb-2">循环模式</p>
              <div className="flex flex-wrap gap-1.5">
                {memory.recurring_patterns.map((pattern, i) => (
                  <span
                    key={i}
                    className="inline-block px-2.5 py-1 rounded-full text-[11px] bg-white/[0.05] text-foreground/70 border border-white/8"
                  >
                    {pattern}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
