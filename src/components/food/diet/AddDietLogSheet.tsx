"use client";

import { useState, useEffect, useMemo } from "react";
import { Loader2, Plus } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { useFoodStore } from "@/store/food-store";
import type { FoodRow } from "@/lib/food-service";
import type { RecipeRow } from "@/lib/recipe-service";
import type { MealType } from "@/lib/diet-log-service";
import { FoodSearchSheet } from "../common/FoodSearchSheet";

interface AddDietLogSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: string;
  defaultMeal?: MealType;
}

const MEAL_OPTIONS: { value: MealType; label: string }[] = [
  { value: "breakfast", label: "早餐" },
  { value: "lunch", label: "午餐" },
  { value: "dinner", label: "晚餐" },
  { value: "snack", label: "加餐" },
];

type PickMode = "food" | "recipe";

export function AddDietLogSheet({ open, onOpenChange, selectedDate, defaultMeal = "breakfast" }: AddDietLogSheetProps) {
  const recipes = useFoodStore((s) => s.recipes);
  const addDietLog = useFoodStore((s) => s.addDietLog);

  const [mode, setMode] = useState<PickMode>("food");
  const [mealType, setMealType] = useState<MealType>(defaultMeal);
  const [selectedFood, setSelectedFood] = useState<FoodRow | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeRow | null>(null);
  const [quantity, setQuantity] = useState(""); // grams for food
  const [servings, setServings] = useState("1"); // servings for recipe
  const [note, setNote] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (open) {
      setMode("food");
      setMealType(defaultMeal);
      setSelectedFood(null);
      setSelectedRecipe(null);
      setQuantity("");
      setServings("1");
      setNote("");
      setToast("");
    }
  }, [open, defaultMeal]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2000);
  };

  const preview = useMemo(() => {
    if (mode === "food" && selectedFood) {
      const qty = Number(quantity) || selectedFood.default_serving_g;
      const ratio = qty / 100;
      return {
        energy: Math.round(selectedFood.energy_kcal * ratio),
        protein: round1(selectedFood.protein_g * ratio),
        fat: round1(selectedFood.fat_g * ratio),
        carb: round1(selectedFood.carb_g * ratio),
        unit: "g",
        amount: qty,
      };
    }
    if (mode === "recipe" && selectedRecipe) {
      const sv = Number(servings) || 1;
      return {
        energy: Math.round((selectedRecipe.energy_kcal_per_serving ?? 0) * sv),
        protein: round1((selectedRecipe.protein_g_per_serving ?? 0) * sv),
        fat: round1((selectedRecipe.fat_g_per_serving ?? 0) * sv),
        carb: round1((selectedRecipe.carb_g_per_serving ?? 0) * sv),
        unit: "份",
        amount: sv,
      };
    }
    return null;
  }, [mode, selectedFood, selectedRecipe, quantity, servings]);

  const handleSave = async () => {
    if (mode === "food" && !selectedFood) {
      showToast("请先选择食物");
      return;
    }
    if (mode === "recipe" && !selectedRecipe) {
      showToast("请先选择菜谱");
      return;
    }

    setSaving(true);
    try {
      const log = await addDietLog({
        log_date: selectedDate,
        meal_type: mealType,
        food_id: mode === "food" ? selectedFood!.id : undefined,
        recipe_id: mode === "recipe" ? selectedRecipe!.id : undefined,
        servings: mode === "recipe" ? Number(servings) || 1 : undefined,
        quantity_g: mode === "food" ? Number(quantity) || selectedFood!.default_serving_g : undefined,
        note: note.trim() || undefined,
      });
      if (log) {
        onOpenChange(false);
      } else {
        showToast("保存失败");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="bg-midnight border-white/10 rounded-t-3xl max-h-[92vh]">
          <SheetHeader>
            <SheetTitle className="text-glow-gold">添加饮食记录</SheetTitle>
            <SheetDescription className="text-muted/60">{selectedDate}</SheetDescription>
          </SheetHeader>

          <div className="flex-1 px-4 overflow-y-auto space-y-4 pb-2">
            {/* Meal type */}
            <div className="flex gap-2">
              {MEAL_OPTIONS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setMealType(m.value)}
                  className={`flex-1 py-2 rounded-xl text-xs transition-colors ${
                    mealType === m.value
                      ? "bg-glow-gold/90 text-midnight"
                      : "bg-white/[0.03] border border-white/8 text-muted/70"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Mode toggle */}
            <div className="flex gap-2 p-1 rounded-full bg-white/[0.03] border border-white/8">
              <button
                onClick={() => setMode("food")}
                className={`flex-1 py-1.5 rounded-full text-xs transition-colors ${
                  mode === "food" ? "bg-glow-gold/80 text-midnight" : "text-muted/70"
                }`}
              >
                食物
              </button>
              <button
                onClick={() => setMode("recipe")}
                className={`flex-1 py-1.5 rounded-full text-xs transition-colors ${
                  mode === "recipe" ? "bg-glow-gold/80 text-midnight" : "text-muted/70"
                }`}
              >
                菜谱
              </button>
            </div>

            {/* Selection */}
            {mode === "food" ? (
              selectedFood ? (
                <div className="rounded-xl bg-white/[0.03] border border-white/8 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-foreground/90">{selectedFood.name}</p>
                      <p className="text-xs text-muted/40">{selectedFood.default_serving_name} · {selectedFood.category ?? "其他"}</p>
                    </div>
                    <button onClick={() => setSearchOpen(true)} className="text-xs text-glow-gold/70 hover:text-glow-gold">
                      更换
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted/60">用量 (克)</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder={String(selectedFood.default_serving_g)}
                      className="w-full bg-white/[0.03] border border-white/8 rounded-xl p-2.5 text-sm text-foreground placeholder:text-muted/30 focus:outline-none focus:border-glow-gold/30"
                    />
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setSearchOpen(true)}
                  className="w-full flex items-center justify-center gap-2 py-6 rounded-xl bg-white/[0.02] border border-dashed border-white/10 text-sm text-muted/60 hover:bg-white/[0.04] transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  搜索添加食物
                </button>
              )
            ) : selectedRecipe ? (
              <div className="rounded-xl bg-white/[0.03] border border-white/8 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-foreground/90">{selectedRecipe.name}</p>
                    <p className="text-xs text-muted/40">{selectedRecipe.servings} 人份</p>
                  </div>
                  <button onClick={() => setSelectedRecipe(null)} className="text-xs text-glow-gold/70 hover:text-glow-gold">
                    更换
                  </button>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted/60">份数</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={servings}
                    onChange={(e) => setServings(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/8 rounded-xl p-2.5 text-sm text-foreground focus:outline-none focus:border-glow-gold/30"
                  />
                </div>
              </div>
            ) : recipes.length === 0 ? (
              <div className="rounded-xl bg-white/[0.02] border border-white/8 p-4 text-center text-xs text-muted/40">
                还没有菜谱，去「菜谱」Tab 创建
              </div>
            ) : (
              <div className="space-y-2">
                {recipes.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRecipe(r)}
                    className="w-full flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/8 p-3 hover:bg-white/[0.06] transition-colors text-left"
                  >
                    <div>
                      <p className="text-sm text-foreground/90">{r.name}</p>
                      <p className="text-xs text-muted/40">{r.servings} 人份</p>
                    </div>
                    <span className="text-xs text-glow-gold/70">{Math.round(r.energy_kcal_per_serving ?? 0)} kcal/份</span>
                  </button>
                ))}
              </div>
            )}

            {/* Nutrition preview */}
            {preview && (
              <div className="rounded-xl bg-glow-gold/[0.04] border border-glow-gold/15 p-3">
                <p className="text-xs text-muted/60 mb-2">营养预估（{preview.amount}{preview.unit}）</p>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <NutrientChip label="热量" value={`${preview.energy}`} unit="kcal" />
                  <NutrientChip label="蛋白" value={`${preview.protein}`} unit="g" />
                  <NutrientChip label="脂肪" value={`${preview.fat}`} unit="g" />
                  <NutrientChip label="碳水" value={`${preview.carb}`} unit="g" />
                </div>
              </div>
            )}

            {/* Note */}
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={100}
              placeholder="备注（可选）"
              className="w-full bg-white/[0.03] border border-white/8 rounded-xl p-2.5 text-sm text-foreground placeholder:text-muted/30 focus:outline-none focus:border-glow-gold/30"
            />
          </div>

          <SheetFooter className="border-t border-white/8">
            <button
              onClick={handleSave}
              disabled={saving || !preview}
              className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-glow-gold text-midnight text-sm font-semibold disabled:opacity-50 hover:bg-glow-gold/90 active:scale-[0.98] transition-all"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              保存记录
            </button>
            {toast && <p className="text-center text-xs text-glow-gold/80">{toast}</p>}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <FoodSearchSheet
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onSelect={(food) => {
          setSelectedFood(food);
          setQuantity(String(food.default_serving_g));
        }}
      />
    </>
  );
}

function NutrientChip({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div>
      <p className="text-sm text-foreground/90">{value}<span className="text-[10px] text-muted/40 ml-0.5">{unit}</span></p>
      <p className="text-[10px] text-muted/50">{label}</p>
    </div>
  );
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
