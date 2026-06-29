"use client";

import { useRouter } from "next/navigation";
import { Database, ChevronRight } from "lucide-react";

export function MemoryCard() {
  const router = useRouter();

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-center gap-2 mb-4">
        <Database className="h-4 w-4 text-glow-gold/70" />
        <h2 className="text-sm font-medium text-foreground/90">
          用户档案库
        </h2>
      </div>

      <button
        onClick={() => router.push("/my/archive")}
        className="w-full flex items-center justify-between p-4 rounded-xl border border-white/8 bg-white/[0.02] hover:border-glow-gold/30 hover:bg-white/[0.04] transition-all group"
      >
        <div className="flex items-center gap-3 text-left">
          <span className="text-lg">🧠</span>
          <div>
            <p className="text-sm font-medium text-foreground/85">
              个人心智档案
            </p>
            <p className="text-xs text-muted/50 mt-0.5">
              历史日记深度提炼的性格模型与事件线
            </p>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted/40 group-hover:text-glow-gold/60 transition-colors" />
      </button>
    </section>
  );
}
