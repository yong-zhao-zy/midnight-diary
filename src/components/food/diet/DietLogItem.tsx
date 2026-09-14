"use client";

import { Trash2 } from "lucide-react";
import type { DietLogWithNames } from "@/lib/diet-log-service";

interface DietLogItemProps {
  log: DietLogWithNames;
  onDelete: (id: string) => void;
}

export function DietLogItem({ log, onDelete }: DietLogItemProps) {
  const name = log.food_name ?? log.recipe_name ?? "未知";
  const amountLabel = log.food_id
    ? `${log.quantity_g ?? 0}g`
    : `${log.servings} 份`;

  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-white/[0.03] border border-white/8 p-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground/90 truncate">{name}</p>
        <p className="text-xs text-muted/40 mt-0.5">
          {amountLabel} · 蛋{round1(log.protein_g)} 脂{round1(log.fat_g)} 碳{round1(log.carb_g)}
          {log.note ? ` · ${log.note}` : ""}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm text-glow-gold/80">{Math.round(Number(log.energy_kcal))}<span className="text-[10px] text-muted/40 ml-0.5">kcal</span></p>
      </div>
      <button
        onClick={() => onDelete(log.id)}
        className="p-1.5 rounded-lg text-muted/40 hover:text-rose-400 hover:bg-white/5 transition-colors shrink-0"
        aria-label="删除"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function round1(n: number): number {
  return Math.round((Number(n) || 0) * 10) / 10;
}
