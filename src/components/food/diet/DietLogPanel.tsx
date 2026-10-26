"use client";

import { useState, useMemo, useEffect } from "react";
import { Plus, ChevronDown, ChevronUp } from "lucide-react";
import { useFoodStore } from "@/store/food-store";
import { getPersonalizedDRI, NUTRIENT_LABELS } from "@/config/dri-config";
import type { MealType } from "@/lib/diet-log-service";
import type { DietLogWithNames } from "@/lib/diet-log-service";
import { DietLogItem } from "./DietLogItem";
import { AddDietLogSheet } from "./AddDietLogSheet";
import { DailyAnalysisCard } from "./DailyAnalysisCard";
import { WeekDateBar } from "../common/WeekDateBar";
import { NutrientOverviewGrid } from "../analysis/NutrientOverviewGrid";
import { peekDayAnalysis, refreshDayAnalysis, type DayAnalysisResult } from "@/lib/day-analysis-client";

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

/** 左上角克数三行的顺序：蛋白质 / 碳水 / 脂肪 */
const MACRO_LINE_KEYS = ["protein_g", "carb_g", "fat_g"] as const;

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

  // 四宫格雷达数据：来自服务端 analyzeDay（纯计算不烧 LLM），饮食记录变化时自动刷新
  const [dayResult, setDayResult] = useState<DayAnalysisResult | null>(peekDayAnalysis(selectedDate));
  const [prevDate, setPrevDate] = useState(selectedDate);
  if (prevDate !== selectedDate) {
    setPrevDate(selectedDate);
    setDayResult(peekDayAnalysis(selectedDate));
  }
  const logsKey = `${dietLogs.length}:${fetchedAt ?? ""}`;
  useEffect(() => {
    let cancelled = false;
    void refreshDayAnalysis(selectedDate).then((r) => {
      if (!cancelled && r) setDayResult(r);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedDate, logsKey]);
  const dayAssessments = dayResult?.analysis?.assessments ?? null;

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

      {/* 概览四宫格：左上热量环 + 宏量克数，右上宏量雷达、左下矿物质、右下维生素 */}
      {profileReady && dri ? (
        <NutrientOverviewGrid
          calorie={{
            targetKcal,
            intakeKcal: totalKcal,
            intakeLabel: "已摄入",
            macros: MACRO_LINE_KEYS.map((key) => ({
              label: NUTRIENT_LABELS[key],
              intake: sumKey(dietLogs, key),
              target: dri[key],
            })),
          }}
          assessments={dayAssessments}
        />
      ) : (
        <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-4 text-center">
          <p className="text-xs text-muted/60">
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
          <div className="rounded-xl bg-white/[0.02] border border-white/8 p-4 text-center text-xs text-muted/50">加载中...</div>
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
                      <ChevronUp className="h-3.5 w-3.5 text-muted/60 shrink-0" />
                    ) : (
                      <ChevronDown className={`h-3.5 w-3.5 shrink-0 ${items.length === 0 ? "text-muted/40" : "text-muted/60"}`} />
                    )}
                    <span className="text-sm text-foreground/80 shrink-0">{meal.label}</span>
                    <span className="text-xs text-muted/50 truncate ml-1">
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
