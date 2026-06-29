"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Circle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
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

export default function ArchivePage() {
  const router = useRouter();
  const [memory, setMemory] = useState<MemoryProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const supabase = createClient();

      // Session refresh / auth guard
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const { data: refreshData } = await supabase.auth.refreshSession();
        if (!refreshData.session) {
          router.push("/login");
          return;
        }
      }

      const data = await fetchUserMemory();
      setMemory(data);
      setLoading(false);
    }
    init();
  }, [router]);

  return (
    <div className="min-h-screen bg-midnight text-foreground">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center px-4 pt-[max(0.75rem,env(safe-area-inset-top,0.75rem))] pb-3 bg-midnight/80 backdrop-blur-md border-b border-white/5">
        <button
          onClick={() => router.back()}
          className="h-10 w-10 flex items-center justify-center rounded-full text-muted/50 hover:text-foreground hover:bg-white/10 transition-colors"
        >
          <ArrowLeft className="h-4.5 w-4.5" />
        </button>
        <h1 className="flex-1 text-center text-sm font-medium text-foreground/90 pr-10">
          用户档案库
        </h1>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-5 py-6 space-y-6">
        {loading ? (
          <div className="py-16 text-center text-xs text-muted/50">加载中...</div>
        ) : !memory ? (
          <div className="py-16 text-center text-xs text-muted/50">
            AI 尚未建立你的记忆档案，写完首篇日记后自动生成。
          </div>
        ) : (
          <>
            {/* Section 1: Mental Baseline */}
            {memory.mental_baseline && (
              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-[11px] text-muted/50 mb-3">长期心智画像</p>
                <p className="text-sm text-foreground/80 leading-relaxed tracking-wide">
                  {memory.mental_baseline}
                </p>
              </section>
            )}

            {/* Section 2: Recurring Patterns */}
            {memory.recurring_patterns.length > 0 && (
              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-[11px] text-muted/50 mb-3">行为与情绪模式</p>
                <div className="space-y-2.5">
                  {memory.recurring_patterns.map((pattern, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className="mt-0.5 text-glow-gold/60 text-xs shrink-0">✦</span>
                      <p className="text-sm text-foreground/75 leading-relaxed">
                        {pattern}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Section 3: Active Events Timeline */}
            {memory.active_events.length > 0 && (
              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-[11px] text-muted/50 mb-4">活跃事件时间线</p>
                <div className="relative pl-4 border-l border-white/10 space-y-5">
                  {memory.active_events.map((event) => (
                    <div key={event.event_id} className="relative">
                      <Circle className="absolute -left-[calc(1rem+5px)] top-1 h-2.5 w-2.5 fill-glow-gold/60 text-glow-gold/60" />
                      <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3.5 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-foreground/85 flex-1 leading-relaxed">
                            {event.summary}
                          </p>
                          <StatusBadge status={event.status} />
                        </div>
                        <div className="flex items-center flex-wrap gap-3 text-[10px] text-muted/50">
                          {event.key_stakeholders && (
                            <span>干系人：{event.key_stakeholders}</span>
                          )}
                          <span>{event.created_at}</span>
                        </div>
                        {event.user_cognitive_shift && (
                          <p className="text-xs text-foreground/60 leading-relaxed">
                            {event.user_cognitive_shift}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
