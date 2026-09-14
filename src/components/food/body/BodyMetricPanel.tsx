"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useFoodStore } from "@/store/food-store";
import type { BodyMetricRow } from "@/lib/body-metric-service";
import { BodyMetricEditorSheet } from "./BodyMetricEditorSheet";

export function BodyMetricPanel() {
  const bodyMetrics = useFoodStore((s) => s.bodyMetrics);
  const fetchedAt = useFoodStore((s) => s.bodyMetricsFetchedAt);
  const removeBodyMetric = useFoodStore((s) => s.removeBodyMetric);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<BodyMetricRow | null>(null);

  const openNew = () => {
    setEditTarget(null);
    setEditorOpen(true);
  };

  const openEdit = (m: BodyMetricRow) => {
    setEditTarget(m);
    setEditorOpen(true);
  };

  const handleDelete = async (id: string) => {
    await removeBodyMetric(id);
  };

  if (fetchedAt === null) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-xs text-muted/40">加载中...</p>
      </div>
    );
  }

  if (bodyMetrics.length === 0) {
    return (
      <>
        <div className="text-center py-20 space-y-3">
          <p className="text-sm text-muted/70">还没有身体数据</p>
          <p className="text-xs text-muted/40">记录体重和围度，追踪变化趋势</p>
        </div>
        <button
          onClick={openNew}
          className="fixed bottom-8 right-8 flex h-12 w-12 items-center justify-center rounded-full bg-glow-gold shadow-lg shadow-glow-gold/25 text-midnight hover:scale-105 active:scale-95 transition-transform z-40"
          aria-label="记录身体数据"
        >
          <Plus className="h-5 w-5" strokeWidth={2.5} />
        </button>
        <BodyMetricEditorSheet open={editorOpen} onOpenChange={setEditorOpen} editTarget={editTarget} />
      </>
    );
  }

  return (
    <>
      <div className="space-y-3 pb-20">
        {/* Latest highlight */}
        <div className="rounded-2xl bg-glow-gold/[0.04] border border-glow-gold/15 p-4">
          <p className="text-xs text-muted/60 mb-1">最新体重</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl text-glow-gold">{bodyMetrics[0].weight_kg ?? "—"}</span>
            <span className="text-sm text-muted/50">kg</span>
            <span className="text-xs text-muted/40 ml-auto">{formatDateShort(bodyMetrics[0].log_date)}</span>
          </div>
          {bodyMetrics.length > 1 && bodyMetrics[0].weight_kg != null && bodyMetrics[1].weight_kg != null && (
            <p className={`text-xs mt-2 ${(bodyMetrics[0].weight_kg) < (bodyMetrics[1].weight_kg) ? "text-emerald-400/80" : "text-amber-400/80"}`}>
              {(Number(bodyMetrics[0].weight_kg) - Number(bodyMetrics[1].weight_kg)).toFixed(1)} kg vs 上次
            </p>
          )}
        </div>

        {/* History list */}
        {bodyMetrics.map((m) => (
          <div key={m.id} className="rounded-xl bg-white/[0.03] border border-white/8 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm text-foreground/90">{formatDateShort(m.log_date)}</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => openEdit(m)}
                  className="p-1.5 rounded-lg text-muted/40 hover:text-glow-gold hover:bg-white/5 transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(m.id)}
                  className="p-1.5 rounded-lg text-muted/40 hover:text-rose-400 hover:bg-white/5 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted/60">
              {m.weight_kg != null && <span>体重 {m.weight_kg}</span>}
              {m.waist_cm != null && <span>腰 {m.waist_cm}</span>}
              {m.hip_cm != null && <span>臀 {m.hip_cm}</span>}
              {m.chest_cm != null && <span>胸 {m.chest_cm}</span>}
              {m.body_fat_pct != null && <span>体脂 {m.body_fat_pct}%</span>}
              {m.left_thigh_cm != null && <span>大腿 {m.left_thigh_cm}</span>}
            </div>
            {m.note && <p className="text-xs text-muted/40 mt-1">{m.note}</p>}
          </div>
        ))}
      </div>

      <button
        onClick={openNew}
        className="fixed bottom-8 right-8 flex h-12 w-12 items-center justify-center rounded-full bg-glow-gold shadow-lg shadow-glow-gold/25 text-midnight hover:scale-105 active:scale-95 transition-transform z-40"
        aria-label="记录身体数据"
      >
        <Plus className="h-5 w-5" strokeWidth={2.5} />
      </button>

      <BodyMetricEditorSheet open={editorOpen} onOpenChange={setEditorOpen} editTarget={editTarget} />
    </>
  );
}

function formatDateShort(dateStr: string): string {
  const [, m, d] = dateStr.split("-").map(Number);
  return `${m}月${d}日`;
}
