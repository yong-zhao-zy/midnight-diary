"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight, TrendingUp } from "lucide-react";
import { useFoodStore } from "@/store/food-store";
import { getPersonalizedDRI, NUTRIENT_LABELS, type NutrientKey } from "@/config/dri-config";
import { todayShanghaiStr } from "@/lib/date-utils";
import type { DietLogWithNames } from "@/lib/diet-log-service";

const EMPTY_DIET_LOGS: DietLogWithNames[] = [];

interface DailyOverviewProps {
  selectedDate: string;
  onShiftDate: (delta: number) => void;
  onJumpToDiet: () => void;
}

const MEAL_LABELS: Record<string, string> = {
  breakfast: "早餐",
  lunch: "午餐",
  dinner: "晚餐",
  snack: "加餐",
};

const MACRO_KEYS: { key: NutrientKey; color: string }[] = [
  { key: "energy_kcal", color: "bg-glow-gold" },
  { key: "protein_g", color: "bg-rose-400" },
  { key: "fat_g", color: "bg-amber-400" },
  { key: "carb_g", color: "bg-sky-400" },
  { key: "fiber_g", color: "bg-emerald-400" },
];

export function DailyOverview({ selectedDate, onShiftDate, onJumpToDiet }: DailyOverviewProps) {
  const dietLogs = useFoodStore((s) => s.dietLogsByDate[selectedDate] ?? EMPTY_DIET_LOGS);
  const fetchedAt = useFoodStore((s) => s.dietLogsFetchedAt[selectedDate] ?? null);
  const healthProfile = useFoodStore((s) => s.healthProfile);
  const bodyMetrics = useFoodStore((s) => s.bodyMetrics);

  const totals = useMemo(() => {
    const t = { energy_kcal: 0, protein_g: 0, fat_g: 0, carb_g: 0, fiber_g: 0 };
    for (const log of dietLogs) {
      t.energy_kcal += Number(log.energy_kcal) || 0;
      t.protein_g += Number(log.protein_g) || 0;
      t.fat_g += Number(log.fat_g) || 0;
      t.carb_g += Number(log.carb_g) || 0;
      t.fiber_g += Number(log.fiber_g) || 0;
    }
    return t;
  }, [dietLogs]);

  const latestWeight = useMemo(() => {
    for (const m of bodyMetrics) {
      if (m.weight_kg != null) return Number(m.weight_kg);
    }
    return null;
  }, [bodyMetrics]);

  const dri = useMemo(
    () => (latestWeight ? getPersonalizedDRI(healthProfile, latestWeight) : null),
    [healthProfile, latestWeight]
  );

  const profileReady = !!(healthProfile.gender && healthProfile.birth_date);

  const isToday = selectedDate === todayShanghaiStr();
  const dateLabel = formatDateLabel(selectedDate);

  const meals = useMemo(() => groupByMeal(dietLogs), [dietLogs]);

  return (
    <div className="space-y-4 pb-4">
      {/* Date selector */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => onShiftDate(-1)}
          className="p-2 rounded-lg text-muted/70 hover:text-foreground hover:bg-white/5 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-center">
          <p className="text-sm text-foreground">{dateLabel}</p>
          {isToday && <p className="text-xs text-glow-gold/70">今天</p>}
        </div>
        <button
          onClick={() => onShiftDate(1)}
          disabled={isToday}
          className="p-2 rounded-lg text-muted/70 hover:text-foreground hover:bg-white/5 transition-colors disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Nutrition summary vs DRI */}
      {profileReady && dri ? (
        <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-4 space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-muted/60">热量目标</span>
            <span className="text-xs text-muted/50">{Math.round(totals.energy_kcal)} / {dri.energy_kcal} kcal</span>
          </div>
          {MACRO_KEYS.map(({ key, color }) => {
            const actual = totals[key as keyof typeof totals] as number;
            const target = dri[key as keyof typeof dri] as number;
            const pct = target > 0 ? Math.min((actual / target) * 100, 100) : 0;
            return (
              <div key={key} className="space-y-1">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-muted/70">{NUTRIENT_LABELS[key]}</span>
                  <span className="text-muted/50">
                    {formatNum(actual)} / {formatNum(target)}{key === "energy_kcal" ? " kcal" : " g"}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-4 text-center space-y-2">
          <TrendingUp className="h-5 w-5 text-glow-gold/60 mx-auto" />
          <p className="text-sm text-muted/70">完善健康画像，查看个性化营养目标</p>
          <p className="text-xs text-muted/40">点击右上角设置按钮填写性别、出生日期等</p>
        </div>
      )}

      {/* Per-meal breakdown */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm text-foreground/80">餐次分布</h3>
          <button onClick={onJumpToDiet} className="text-xs text-glow-gold/70 hover:text-glow-gold transition-colors">
            管理饮食 →
          </button>
        </div>
        {fetchedAt === null ? (
          <div className="rounded-xl bg-white/[0.02] border border-white/8 p-4 text-center text-xs text-muted/40">加载中...</div>
        ) : dietLogs.length === 0 ? (
          <div className="rounded-xl bg-white/[0.02] border border-white/8 p-4 text-center text-xs text-muted/40">
            当日无饮食记录
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {(["breakfast", "lunch", "dinner", "snack"] as const).map((meal) => {
              const items = meals[meal] ?? [];
              const kcal = items.reduce((s, l) => s + (Number(l.energy_kcal) || 0), 0);
              return (
                <button
                  key={meal}
                  onClick={onJumpToDiet}
                  className="rounded-xl bg-white/[0.03] border border-white/8 p-3 text-left hover:bg-white/[0.05] transition-colors"
                >
                  <p className="text-xs text-muted/60">{MEAL_LABELS[meal]}</p>
                  <p className="text-base text-foreground/90 mt-1">{Math.round(kcal)}<span className="text-xs text-muted/50 ml-1">kcal</span></p>
                  <p className="text-[10px] text-muted/40 mt-0.5">{items.length} 项</p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {latestWeight != null && (
        <div className="rounded-xl bg-white/[0.02] border border-white/8 p-3 flex items-center justify-between">
          <span className="text-xs text-muted/60">最近体重</span>
          <span className="text-sm text-foreground/80">{latestWeight} kg</span>
        </div>
      )}
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

function formatDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  return `${m}月${d}日 周${weekdays[dt.getDay()]}`;
}

function formatNum(n: number): string {
  return Math.round(n * 10) / 10 + "";
}
