"use client";

import { useState, useMemo } from "react";
import { Plus, ChevronDown, ChevronUp } from "lucide-react";
import { useFoodStore } from "@/store/food-store";
import { getPersonalizedDRI, NUTRIENT_LABELS } from "@/config/dri-config";
import type { MealType } from "@/lib/diet-log-service";
import type { DietLogWithNames } from "@/lib/diet-log-service";
import { DietLogItem } from "./DietLogItem";
import { AddDietLogSheet } from "./AddDietLogSheet";
import { DailyAnalysisCard } from "./DailyAnalysisCard";
import { WeekDateBar } from "../common/WeekDateBar";

const EMPTY_DIET_LOGS: DietLogWithNames[] = [];

interface DietLogPanelProps {
  selectedDate: string;
  onSelectDate: (dateStr: string) => void;
}

const MEALS: { value: MealType; label: string }[] = [
  { value: "breakfast", label: "早餐" },
  { value: "lunch", label: "午餐" },
  { value: "dinner", label: "晚餐" },
  { value: "snack", label: "加餐" },
];

const MACRO_BARS: { key: "protein_g" | "fat_g" | "carb_g"; color: string }[] = [
  { key: "protein_g", color: "bg-emerald-400" },
  { key: "carb_g", color: "bg-sky-400" },
  { key: "fat_g", color: "bg-violet-400" },
];

export function DietLogPanel({ selectedDate, onSelectDate }: DietLogPanelProps) {
  const dietLogs = useFoodStore((s) => s.dietLogsByDate[selectedDate] ?? EMPTY_DIET_LOGS);
  const fetchedAt = useFoodStore((s) => s.dietLogsFetchedAt[selectedDate] ?? null);
  const healthProfile = useFoodStore((s) => s.healthProfile);
  const bodyMetrics = useFoodStore((s) => s.bodyMetrics);
  const removeDietLog = useFoodStore((s) => s.removeDietLog);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [defaultMeal, setDefaultMeal] = useState<MealType>("breakfast");
  const [expandedMeal, setExpandedMeal] = useState<MealType | null>(null);

  const grouped = useMemo(() => groupByMeal(dietLogs), [dietLogs]);

  const totalKcal = dietLogs.reduce((s, l) => s + (Number(l.energy_kcal) || 0), 0);

  const latestWeight = useMemo(() => {
    for (const m of bodyMetrics) {
      if (m.weight_kg != null) return Number(m.weight_kg);
    }
    return null;
  }, [bodyMetrics]);

  // 参考体重：最近身体记录 > 画像目标体重（画像必有 calorie_goal/身高时也能算 DRI）
  const refWeight = useMemo(() => {
    if (latestWeight != null) return latestWeight;
    const tw = healthProfile.target_weight_kg;
    return tw != null && Number(tw) > 0 ? Number(tw) : null;
  }, [latestWeight, healthProfile.target_weight_kg]);

  const dri = useMemo(
    () => (refWeight ? getPersonalizedDRI(healthProfile, refWeight) : null),
    [healthProfile, refWeight]
  );

  const profileReady = !!(healthProfile.gender && healthProfile.birth_date);
  const targetKcal = profileReady && dri ? dri.energy_kcal : null;
  const remaining = targetKcal != null ? Math.max(0, targetKcal - totalKcal) : null;
  const overTarget = targetKcal != null && totalKcal > targetKcal;
  // 环形进度：已摄入占比
  const ringPct =
    targetKcal != null && targetKcal > 0 ? Math.min(totalKcal / targetKcal, 1) : 0;
  const RADIUS = 30;
  const CIRC = 2 * Math.PI * RADIUS;

  const openSheet = (meal: MealType) => {
    setDefaultMeal(meal);
    setSheetOpen(true);
  };

  const handleDelete = async (id: string) => {
    await removeDietLog(id, selectedDate);
  };

  return (
    <div className="space-y-4 pb-4">
      {/* 周条 + 单日期日历 */}
      <WeekDateBar selectedDate={selectedDate} onSelectDate={onSelectDate} />

      {/* 概览卡：剩余热量环 + 宏量进度 */}
      {profileReady && dri ? (
        <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-4 flex items-center gap-4">
          {/* 剩余热量环 */}
          <div className="relative shrink-0 h-[76px] w-[76px]">
            <svg viewBox="0 0 76 76" className="h-full w-full -rotate-90">
              <circle cx="38" cy="38" r={RADIUS} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
              <circle
                cx="38"
                cy="38"
                r={RADIUS}
                fill="none"
                stroke={overTarget ? "rgb(251 113 133)" : "rgb(245 178 75)"}
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={`${ringPct * CIRC} ${CIRC}`}
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-lg font-semibold leading-none ${overTarget ? "text-rose-400" : "text-glow-gold"}`}>
                {remaining != null ? Math.round(remaining) : "—"}
              </span>
              <span className="text-[9px] text-muted/45 mt-0.5">剩余 kcal</span>
            </div>
          </div>

          {/* 目标 + 宏量三条 */}
          <div className="flex-1 min-w-0 space-y-2">
            <p className="text-xs text-muted/60">
              目标 {targetKcal ?? "—"} · 已摄入 <span className="text-foreground/80">{Math.round(totalKcal)}</span>
            </p>
            {MACRO_BARS.map(({ key, color }) => {
              const actual = sumKey(dietLogs, key);
              const target = dri[key] as number;
              const pct = target > 0 ? Math.min((actual / target) * 100, 100) : 0;
              return (
                <div key={key} className="space-y-0.5">
                  <div className="flex items-baseline justify-between text-[11px]">
                    <span className="text-muted/70">{NUTRIENT_LABELS[key]}</span>
                    <span className="text-muted/50">
                      {round1(actual)}/{round1(target)} g
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-4 text-center">
          <p className="text-xs text-muted/50">
            合计 {Math.round(totalKcal)} kcal ·
            <button
              onClick={() => document.querySelector<HTMLButtonElement>("[title='健康画像']")?.click()}
              className="text-glow-gold/70 hover:text-glow-gold mx-1"
            >
              完善健康画像
            </button>
            查看个性化目标
          </p>
        </div>
      )}

      {/* 餐次行：加号添加，下拉展开明细 */}
      <div className="space-y-2">
        {fetchedAt === null && dietLogs.length === 0 ? (
          <div className="rounded-xl bg-white/[0.02] border border-white/8 p-4 text-center text-xs text-muted/40">加载中...</div>
        ) : (
          MEALS.map((meal) => {
            const items = grouped[meal.value] ?? [];
            const kcal = items.reduce((s, l) => s + (Number(l.energy_kcal) || 0), 0);
            const expanded = expandedMeal === meal.value;
            return (
              <div key={meal.value} className="rounded-xl bg-white/[0.03] border border-white/8 overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <button
                    onClick={() => setExpandedMeal(expanded ? null : meal.value)}
                    disabled={items.length === 0}
                    className="flex items-center gap-1 min-w-0 flex-1 text-left disabled:cursor-default"
                  >
                    {expanded ? (
                      <ChevronUp className="h-3.5 w-3.5 text-muted/50 shrink-0" />
                    ) : (
                      <ChevronDown className={`h-3.5 w-3.5 shrink-0 ${items.length === 0 ? "text-muted/20" : "text-muted/50"}`} />
                    )}
                    <span className="text-sm text-foreground/80 shrink-0">{meal.label}</span>
                    <span className="text-xs text-muted/40 truncate ml-1">
                      {items.length > 0 ? `${Math.round(kcal)} kcal · ${items.length} 项` : "未记录"}
                    </span>
                  </button>
                  <button
                    onClick={() => openSheet(meal.value)}
                    className="flex items-center justify-center h-7 w-7 rounded-full border border-glow-gold/30 text-glow-gold/80 hover:bg-glow-gold/10 transition-colors shrink-0"
                    aria-label={`添加${meal.label}`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* 下拉展开：该餐已添加的食材 */}
                {expanded && items.length > 0 && (
                  <div className="px-3 pb-3 space-y-2">
                    {items.map((log) => (
                      <DietLogItem key={log.id} log={log} onDelete={handleDelete} />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <DailyAnalysisCard selectedDate={selectedDate} />

      <AddDietLogSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        selectedDate={selectedDate}
        defaultMeal={defaultMeal}
      />
    </div>
  );
}

function groupByMeal(logs: DietLogWithNames[]): Record<string, DietLogWithNames[]> {
  const out: Record<string, DietLogWithNames[]> = { breakfast: [], lunch: [], dinner: [], snack: [] };
  for (const l of logs) {
    const arr = out[l.meal_type];
    if (arr) arr.push(l);
  }
  return out;
}

function sumKey(logs: DietLogWithNames[], key: "protein_g" | "fat_g" | "carb_g"): number {
  return logs.reduce((s, l) => s + (Number(l[key]) || 0), 0);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
