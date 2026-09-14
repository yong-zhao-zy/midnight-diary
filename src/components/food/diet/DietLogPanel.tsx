"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useFoodStore } from "@/store/food-store";
import { todayShanghaiStr } from "@/lib/date-utils";
import type { MealType } from "@/lib/diet-log-service";
import type { DietLogWithNames } from "@/lib/diet-log-service";
import { DietLogItem } from "./DietLogItem";
import { AddDietLogSheet } from "./AddDietLogSheet";

const EMPTY_DIET_LOGS: DietLogWithNames[] = [];

interface DietLogPanelProps {
  selectedDate: string;
  onShiftDate: (delta: number) => void;
}

const MEALS: { value: MealType; label: string }[] = [
  { value: "breakfast", label: "早餐" },
  { value: "lunch", label: "午餐" },
  { value: "dinner", label: "晚餐" },
  { value: "snack", label: "加餐" },
];

export function DietLogPanel({ selectedDate, onShiftDate }: DietLogPanelProps) {
  const dietLogs = useFoodStore((s) => s.dietLogsByDate[selectedDate] ?? EMPTY_DIET_LOGS);
  const removeDietLog = useFoodStore((s) => s.removeDietLog);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [defaultMeal, setDefaultMeal] = useState<MealType>("breakfast");

  const isToday = selectedDate === todayShanghaiStr();
  const grouped = useMemo(() => groupByMeal(dietLogs), [dietLogs]);

  const totalKcal = dietLogs.reduce((s, l) => s + (Number(l.energy_kcal) || 0), 0);

  const openSheet = (meal: MealType) => {
    setDefaultMeal(meal);
    setSheetOpen(true);
  };

  const handleDelete = async (id: string) => {
    await removeDietLog(id, selectedDate);
  };

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
          <p className="text-sm text-foreground">{formatDateLabel(selectedDate)}</p>
          <p className="text-xs text-muted/40">合计 {Math.round(totalKcal)} kcal</p>
        </div>
        <button
          onClick={() => onShiftDate(1)}
          disabled={isToday}
          className="p-2 rounded-lg text-muted/70 hover:text-foreground hover:bg-white/5 transition-colors disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Meal groups */}
      <div className="space-y-4">
        {MEALS.map((meal) => {
          const items = grouped[meal.value] ?? [];
          const kcal = items.reduce((s, l) => s + (Number(l.energy_kcal) || 0), 0);
          return (
            <div key={meal.value} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm text-foreground/80">{meal.label}</h3>
                  {items.length > 0 && (
                    <span className="text-xs text-muted/40">{Math.round(kcal)} kcal</span>
                  )}
                </div>
                <button
                  onClick={() => openSheet(meal.value)}
                  className="flex items-center gap-1 text-xs text-glow-gold/70 hover:text-glow-gold transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  添加
                </button>
              </div>
              {items.length === 0 ? (
                <div className="rounded-xl bg-white/[0.02] border border-white/8 border-dashed py-3 text-center text-xs text-muted/30">
                  暂无记录
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((log) => (
                    <DietLogItem key={log.id} log={log} onDelete={handleDelete} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

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

function formatDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  return `${m}月${d}日 周${weekdays[dt.getDay()]}`;
}
