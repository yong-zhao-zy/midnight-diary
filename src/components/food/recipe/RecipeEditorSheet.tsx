"use client";

import { useState, useEffect, useMemo } from "react";
import { Loader2, Plus, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { useFoodStore } from "@/store/food-store";
import { calculateRecipeNutrition } from "@/lib/recipe-service";
import type { RecipeWithIngredients } from "@/lib/recipe-service";
import type { FoodRow } from "@/lib/food-service";
import { FoodSearchSheet } from "../common/FoodSearchSheet";

interface RecipeEditorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editTarget?: RecipeWithIngredients | null;
}

interface IngredientDraft {
  food: FoodRow;
  quantity_g: number;
}

export function RecipeEditorSheet({ open, onOpenChange, editTarget }: RecipeEditorSheetProps) {
  const addRecipe = useFoodStore((s) => s.addRecipe);
  const updateRecipe = useFoodStore((s) => s.updateRecipe);

  const [name, setName] = useState("");
  const [servings, setServings] = useState("1");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [ingredients, setIngredients] = useState<IngredientDraft[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (open) {
      setToast("");
      if (editTarget) {
        setName(editTarget.name);
        setServings(String(editTarget.servings));
        setDescription(editTarget.description ?? "");
        setInstructions(editTarget.instructions ?? "");
        setIngredients(
          editTarget.ingredients.map((ing) => ({
            food: ing.food,
            quantity_g: ing.quantity_g,
          }))
        );
      } else {
        setName("");
        setServings("1");
        setDescription("");
        setInstructions("");
        setIngredients([]);
      }
    }
  }, [open, editTarget]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2000);
  };

  const nutrition = useMemo(() => {
    if (ingredients.length === 0) return null;
    return calculateRecipeNutrition(
      ingredients.map((ing) => ({ quantity_g: ing.quantity_g, food: ing.food })),
      Number(servings) || 1
    );
  }, [ingredients, servings]);

  const addIngredient = (food: FoodRow) => {
    setIngredients((prev) => {
      if (prev.some((ing) => ing.food.id === food.id)) {
        showToast("已添加过该食材");
        return prev;
      }
      return [...prev, { food, quantity_g: 100 }];
    });
  };

  const updateQty = (foodId: string, qty: number) => {
    setIngredients((prev) =>
      prev.map((ing) => (ing.food.id === foodId ? { ...ing, quantity_g: Math.max(0, qty) } : ing))
    );
  };

  const removeIngredient = (foodId: string) => {
    setIngredients((prev) => prev.filter((ing) => ing.food.id !== foodId));
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      showToast("菜谱名称不能为空");
      return;
    }
    if (ingredients.length === 0) {
      showToast("至少添加一种食材");
      return;
    }
    const sv = Number(servings) || 1;
    if (sv <= 0) {
      showToast("份数需大于 0");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: trimmedName,
        description: description.trim() || undefined,
        servings: sv,
        instructions: instructions.trim() || undefined,
        ingredients: ingredients.map((ing) => ({
          food_id: ing.food.id,
          quantity_g: ing.quantity_g,
        })),
      };
      const ok = editTarget
        ? await updateRecipe(editTarget.id, payload)
        : await addRecipe(payload);
      if (ok) {
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
        <SheetContent side="bottom" className="bg-midnight border-white/10 rounded-t-3xl h-[92vh]">
          <SheetHeader>
            <SheetTitle className="text-glow-gold">{editTarget ? "编辑菜谱" : "新建菜谱"}</SheetTitle>
            <SheetDescription className="text-muted/60">按食材明细自动计算每份营养</SheetDescription>
          </SheetHeader>

          <div className="flex-1 px-4 overflow-y-auto space-y-4 pb-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              placeholder="菜谱名称"
              className="w-full bg-white/[0.03] border border-white/8 rounded-xl p-3 text-sm text-foreground placeholder:text-muted/30 focus:outline-none focus:border-glow-gold/30"
            />

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs text-muted/60">份数</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={servings}
                  onChange={(e) => setServings(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/8 rounded-xl p-2.5 text-sm text-foreground focus:outline-none focus:border-glow-gold/30"
                />
              </div>
            </div>

            {/* Ingredients */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs text-muted/60">食材明细</label>
                <button
                  onClick={() => setSearchOpen(true)}
                  className="flex items-center gap-1 text-xs text-glow-gold/70 hover:text-glow-gold transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  添加食材
                </button>
              </div>
              {ingredients.length === 0 ? (
                <div className="rounded-xl bg-white/[0.02] border border-white/8 border-dashed py-4 text-center text-xs text-muted/30">
                  点击「添加食材」搜索加入
                </div>
              ) : (
                <div className="space-y-2">
                  {ingredients.map((ing) => (
                    <div key={ing.food.id} className="flex items-center gap-2 rounded-xl bg-white/[0.03] border border-white/8 p-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-foreground/90 truncate">{ing.food.name}</p>
                        <p className="text-[10px] text-muted/40">{Math.round(ing.food.energy_kcal)} kcal/100g</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <input
                          type="number"
                          inputMode="decimal"
                          value={ing.quantity_g}
                          onChange={(e) => updateQty(ing.food.id, Number(e.target.value))}
                          className="w-16 bg-white/[0.03] border border-white/8 rounded-lg px-2 py-1 text-xs text-foreground text-right focus:outline-none focus:border-glow-gold/30"
                        />
                        <span className="text-xs text-muted/40">g</span>
                        <button
                          onClick={() => removeIngredient(ing.food.id)}
                          className="p-1 rounded-lg text-muted/40 hover:text-rose-400 hover:bg-white/5 transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Nutrition preview */}
            {nutrition && (
              <div className="rounded-xl bg-glow-gold/[0.04] border border-glow-gold/15 p-3">
                <p className="text-xs text-muted/60 mb-2">每份营养预估</p>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <PreviewChip label="热量" value={`${Math.round(nutrition.energy_kcal)}`} unit="kcal" />
                  <PreviewChip label="蛋白" value={round1(nutrition.protein_g)} unit="g" />
                  <PreviewChip label="脂肪" value={round1(nutrition.fat_g)} unit="g" />
                  <PreviewChip label="碳水" value={round1(nutrition.carb_g)} unit="g" />
                </div>
              </div>
            )}

            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={100}
              placeholder="简短描述（可选）"
              className="w-full bg-white/[0.03] border border-white/8 rounded-xl p-2.5 text-sm text-foreground placeholder:text-muted/30 focus:outline-none focus:border-glow-gold/30"
            />

            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              maxLength={500}
              placeholder="做法步骤（可选）"
              rows={3}
              className="w-full bg-white/[0.03] border border-white/8 rounded-xl p-3 text-sm text-foreground placeholder:text-muted/30 focus:outline-none focus:border-glow-gold/30 resize-none"
            />
          </div>

          <SheetFooter className="border-t border-white/8">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-glow-gold text-midnight text-sm font-semibold disabled:opacity-50 hover:bg-glow-gold/90 active:scale-[0.98] transition-all"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editTarget ? "保存修改" : "创建菜谱"}
            </button>
            {toast && <p className="text-center text-xs text-glow-gold/80">{toast}</p>}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <FoodSearchSheet
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onSelect={addIngredient}
        excludeIds={ingredients.map((ing) => ing.food.id)}
      />
    </>
  );
}

function PreviewChip({ label, value, unit }: { label: string; value: number | string; unit: string }) {
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
