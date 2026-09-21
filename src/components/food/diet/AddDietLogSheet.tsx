"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Loader2, Search, Sparkles } from "lucide-react";
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
import type { FoodEvaluation } from "@/lib/food-evaluation";

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

const EMPTY_FOODS: FoodRow[] = [];

export function AddDietLogSheet({ open, onOpenChange, selectedDate, defaultMeal = "breakfast" }: AddDietLogSheetProps) {
  const recipes = useFoodStore((s) => s.recipes);
  const addDietLog = useFoodStore((s) => s.addDietLog);
  const searchFoods = useFoodStore((s) => s.searchFoods);
  const aiEstimating = useFoodStore((s) => s.aiEstimating);

  const [mode, setMode] = useState<PickMode>("food");
  const [mealType, setMealType] = useState<MealType>(defaultMeal);
  const [selectedFood, setSelectedFood] = useState<FoodRow | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeRow | null>(null);
  const [quantity, setQuantity] = useState(""); // grams for food
  const [useDefaultServing, setUseDefaultServing] = useState(true);
  const [servings, setServings] = useState("1"); // servings for recipe
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  // Inline search state（食物模式内联搜索，取代独立 FoodSearchSheet）
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FoodRow[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [frequentLoading, setFrequentLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 食物营养评价（标签式 + AI 点评，选中食物后自动 fetch 标签，AI 点评按需）
  const [evaluation, setEvaluation] = useState<FoodEvaluation | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const [aiComment, setAiComment] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const evalFetchedRef = useRef<string | null>(null);

  const frequentFoods = useFoodStore((s) => s.frequentFoodsCache[mealType]?.foods ?? EMPTY_FOODS);
  const ensureFrequentFoods = useFoodStore((s) => s.ensureFrequentFoods);

  useEffect(() => {
    if (open) {
      setMode("food");
      setMealType(defaultMeal);
      setSelectedFood(null);
      setSelectedRecipe(null);
      setQuantity("");
      setUseDefaultServing(true);
      setServings("1");
      setNote("");
      setToast("");
      setQuery("");
      setSearchResults([]);
      setSearchLoading(false);
      setEvaluation(null);
      setEvalLoading(false);
      setAiComment(null);
      setAiLoading(false);
      evalFetchedRef.current = null;
    }
  }, [open, defaultMeal]);

  // 搜索面板可见时加载该餐次常用食物
  useEffect(() => {
    if (!open || mode !== "food" || selectedFood) return;
    let active = true;
    setFrequentLoading(true);
    ensureFrequentFoods(mealType).finally(() => {
      if (active) setFrequentLoading(false);
    });
    return () => {
      active = false;
    };
  }, [open, mode, mealType, selectedFood, ensureFrequentFoods]);

  // 卸载时清理防抖计时器
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2000);
  };

  const handleInput = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val.trim()) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      const found = await searchFoods(val);
      setSearchResults(found);
      setSearchLoading(false);
    }, 300);
  };

  const selectFood = (food: FoodRow) => {
    setSelectedFood(food);
    setQuantity(String(food.default_serving_g));
    setUseDefaultServing(true);
    setQuery("");
    setSearchResults([]);
    setEvaluation(null);
    setEvalLoading(false);
    setAiComment(null);
    setAiLoading(false);
    evalFetchedRef.current = null;
  };

  // 选中食物后自动 fetch 评价标签（默认展开，无需点击）
  useEffect(() => {
    if (!selectedFood) return;
    if (evalFetchedRef.current === selectedFood.id) return;
    evalFetchedRef.current = selectedFood.id;
    setEvalLoading(true);
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/foods/${selectedFood.id}/evaluate`, { method: "POST" });
        const data = await res.json().catch(() => null);
        if (active && res.ok && data?.evaluation) {
          setEvaluation(data.evaluation as FoodEvaluation);
        }
      } catch {
        // 静默失败，标签不显示即可
      } finally {
        if (active) setEvalLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [selectedFood]);

  // AI 点评：点了才调（不自动触发）
  const fetchAiComment = async () => {
    if (!selectedFood || aiComment || aiLoading) return;
    setAiLoading(true);
    try {
      const res = await fetch(`/api/foods/${selectedFood.id}/evaluate`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.aiComment) {
        setAiComment(data.aiComment as string);
        if (!evaluation && data?.evaluation) {
          setEvaluation(data.evaluation as FoodEvaluation);
        }
      } else {
        setAiComment("（AI 点评暂不可用）");
      }
    } catch {
      setAiComment("（AI 点评失败，请稍后重试）");
    } finally {
      setAiLoading(false);
    }
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

  const mealLabel = MEAL_OPTIONS.find((m) => m.value === mealType)?.label ?? "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="top" className="bg-midnight border-white/10 rounded-b-3xl h-[80vh] overflow-hidden">
        <SheetHeader className="shrink-0">
          <SheetTitle className="text-glow-gold">添加饮食记录</SheetTitle>
          <SheetDescription className="text-muted/60">{selectedDate}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 px-4 overflow-y-auto space-y-4 pb-2">
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
                {/* 顶行：食物名 + 用量 + 更换 */}
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground/90 truncate">
                      {selectedFood.name}
                      {selectedFood.source === "ai" && (
                        <span className="ml-1.5 inline-block text-[10px] text-glow-gold/70 bg-glow-gold/10 px-1.5 py-0.5 rounded align-middle">估算</span>
                      )}
                    </p>
                    <p className="text-[10px] text-muted/40">{selectedFood.default_serving_name} · {selectedFood.category ?? "其他"}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <input
                      type="number"
                      inputMode="decimal"
                      value={quantity}
                      onChange={(e) => {
                        setQuantity(e.target.value);
                        setUseDefaultServing(false);
                      }}
                      placeholder={String(selectedFood.default_serving_g)}
                      className="w-16 bg-white/[0.03] border border-white/8 rounded-lg px-2 py-1.5 text-sm text-center text-foreground placeholder:text-muted/30 focus:outline-none focus:border-glow-gold/30"
                    />
                    <span className="text-[10px] text-muted/40">g</span>
                  </div>
                  <button onClick={() => setSelectedFood(null)} className="text-xs text-glow-gold/70 hover:text-glow-gold shrink-0">
                    更换
                  </button>
                </div>
                <p className="text-[10px] text-muted/40">
                  1 {selectedFood.default_serving_name} = {selectedFood.default_serving_g}g
                </p>

                {/* 营养预估：饼图 + 三大营养占比 */}
                {preview && (
                  <div className="rounded-xl bg-white/[0.02] border border-white/8 p-3">
                    <p className="text-xs text-muted/60 mb-2">营养预估（{preview.amount}{preview.unit}）</p>
                    <div className="flex items-center gap-3">
                      <NutritionDonut
                        protein={preview.protein}
                        fat={preview.fat}
                        carb={preview.carb}
                        energy={preview.energy}
                      />
                      <div className="flex-1 space-y-1.5">
                        <MacroRow label="蛋白" value={preview.protein} unit="g" color="emerald" />
                        <MacroRow label="脂肪" value={preview.fat} unit="g" color="amber" />
                        <MacroRow label="碳水" value={preview.carb} unit="g" color="sky" />
                      </div>
                    </div>
                  </div>
                )}

                {/* 营养评价：默认展开 */}
                <div className="rounded-xl bg-white/[0.02] border border-white/8 p-3">
                  <p className="text-xs text-muted/60 mb-2 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-glow-gold/60" />
                    营养评价
                  </p>
                  {evalLoading ? (
                    <div className="flex items-center justify-center py-3">
                      <Loader2 className="h-4 w-4 animate-spin text-glow-gold/40" />
                    </div>
                  ) : evaluation ? (
                    <>
                      <div className="flex flex-wrap gap-1.5">
                        {evaluation.all_tags.map((tag, i) => (
                          <span
                            key={i}
                            className={`inline-block text-[10px] px-2 py-1 rounded-md ${
                              tag.tone === "good"
                                ? "bg-emerald-500/10 text-emerald-300/80 border border-emerald-500/15"
                                : tag.tone === "warn"
                                ? "bg-rose-500/10 text-rose-300/80 border border-rose-500/15"
                                : "bg-white/[0.04] text-muted/60 border border-white/8"
                            }`}
                          >
                            {tag.label}
                          </span>
                        ))}
                      </div>
                      {evaluation.all_tags.some((t) => t.detail) && (
                        <div className="mt-2 space-y-0.5">
                          {evaluation.all_tags.filter((t) => t.detail).map((t, i) => (
                            <p key={i} className="text-[10px] text-muted/40 leading-relaxed">
                              · {t.label}：{t.detail}
                            </p>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-[10px] text-muted/40 text-center py-2">评价加载失败</p>
                  )}

                  {/* AI 点评：点了才调 */}
                  {aiComment ? (
                    <div className="mt-2.5 rounded-lg bg-glow-gold/[0.04] border border-glow-gold/12 p-2.5">
                      <p className="text-[11px] text-foreground/75 leading-relaxed">{aiComment}</p>
                    </div>
                  ) : (
                    <button
                      onClick={fetchAiComment}
                      disabled={aiLoading}
                      className="mt-2.5 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-glow-gold/10 border border-glow-gold/20 text-xs text-glow-gold/80 hover:bg-glow-gold/15 transition-colors disabled:opacity-50"
                    >
                      {aiLoading ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          AI 点评中...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5" />
                          AI 营养师点评
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              // 内联搜索：输入框 + 结果列表（空输入显示该餐次常用食物，输入时实时匹配）
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted/40" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => handleInput(e.target.value)}
                    placeholder="搜索食物名称"
                    className="w-full bg-white/[0.03] border border-white/8 rounded-xl pl-9 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted/30 focus:outline-none focus:border-glow-gold/30"
                  />
                </div>

                <div className="max-h-[280px] overflow-y-auto -mx-1 px-1 space-y-1.5">
                  {query.trim() === "" ? (
                    frequentLoading ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-4 w-4 animate-spin text-glow-gold/40" />
                      </div>
                    ) : frequentFoods.length === 0 ? (
                      <p className="text-center text-xs text-muted/40 py-6">搜索食物名称，或从常用中选择</p>
                    ) : (
                      <>
                        <p className="text-[10px] text-muted/40 px-2">常用{mealLabel}</p>
                        {frequentFoods.map((food) => (
                          <FoodResultRow key={food.id} food={food} onSelect={selectFood} />
                        ))}
                      </>
                    )
                  ) : searchLoading ? (
                    <div className="flex flex-col items-center justify-center py-6 gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-glow-gold/40" />
                      {aiEstimating && <p className="text-xs text-glow-gold/60">AI 正在估算营养...</p>}
                    </div>
                  ) : searchResults.length === 0 ? (
                    <p className="text-center text-xs text-muted/40 py-6">未找到该食物，请尝试其他关键词</p>
                  ) : (
                    searchResults.map((food) => (
                      <FoodResultRow key={food.id} food={food} onSelect={selectFood} />
                    ))
                  )}
                </div>
              </div>
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

          {/* Nutrition preview — recipe 模式（food 模式在卡片内用饼图） */}
          {preview && mode === "recipe" && (
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

        <SheetFooter className="shrink-0 border-t border-white/8">
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
  );
}

function FoodResultRow({ food, onSelect }: { food: FoodRow; onSelect: (food: FoodRow) => void }) {
  return (
    <button
      onClick={() => onSelect(food)}
      className="w-full flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/8 p-3 hover:bg-white/[0.06] transition-colors text-left"
    >
      <div>
        <p className="text-sm text-foreground/90">
          {food.name}
          {food.source === "ai" && (
            <span className="ml-1.5 inline-block text-[10px] text-glow-gold/70 bg-glow-gold/10 px-1.5 py-0.5 rounded align-middle">估算</span>
          )}
        </p>
        <p className="text-xs text-muted/40 mt-0.5">{food.category ?? "其他"} · {food.default_serving_name}</p>
      </div>
      <div className="text-right">
        <p className="text-sm text-glow-gold/80">{Math.round(food.energy_kcal)}<span className="text-xs text-muted/40 ml-0.5">kcal</span></p>
        <p className="text-[10px] text-muted/40">每 100g</p>
      </div>
    </button>
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

/**
 * 三大营养素供能占比环形图（纯 SVG，无依赖）
 * 蛋白 4kcal/g、脂肪 9kcal/g、碳水 4kcal/g，按供能比画三段弧。
 */
function NutritionDonut({
  protein,
  fat,
  carb,
  energy,
}: {
  protein: number;
  fat: number;
  carb: number;
  energy: number;
}) {
  const pCal = protein * 4;
  const fCal = fat * 9;
  const cCal = carb * 4;
  const total = pCal + fCal + cCal;
  const r = 26;
  const size = 72;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * r;

  if (total <= 0) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
        <text x={cx} y={cy - 2} textAnchor="middle" dominantBaseline="middle" className="fill-foreground" fontSize="13" fontWeight="600">
          {Math.round(energy)}
        </text>
        <text x={cx} y={cy + 11} textAnchor="middle" className="fill-muted-foreground" fontSize="8">
          kcal
        </text>
      </svg>
    );
  }

  const pLen = (pCal / total) * C;
  const fLen = (fCal / total) * C;
  const cLen = (cCal / total) * C;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
      <circle
        cx={cx} cy={cy} r={r} fill="none" stroke="#34d399" strokeWidth="7"
        strokeDasharray={`${pLen} ${C - pLen}`} strokeDashoffset={0}
        transform={`rotate(-90 ${cx} ${cy})`} strokeLinecap="butt"
      />
      <circle
        cx={cx} cy={cy} r={r} fill="none" stroke="#fbbf24" strokeWidth="7"
        strokeDasharray={`${fLen} ${C - fLen}`} strokeDashoffset={-pLen}
        transform={`rotate(-90 ${cx} ${cy})`} strokeLinecap="butt"
      />
      <circle
        cx={cx} cy={cy} r={r} fill="none" stroke="#38bdf8" strokeWidth="7"
        strokeDasharray={`${cLen} ${C - cLen}`} strokeDashoffset={-(pLen + fLen)}
        transform={`rotate(-90 ${cx} ${cy})`} strokeLinecap="butt"
      />
      <text x={cx} y={cy - 2} textAnchor="middle" dominantBaseline="middle" className="fill-foreground" fontSize="13" fontWeight="600">
        {Math.round(energy)}
      </text>
      <text x={cx} y={cy + 11} textAnchor="middle" className="fill-muted-foreground" fontSize="8">
        kcal
      </text>
    </svg>
  );
}

const MACRO_COLORS: Record<string, string> = {
  emerald: "bg-emerald-400",
  amber: "bg-amber-400",
  sky: "bg-sky-400",
};

function MacroRow({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: number;
  unit: string;
  color: "emerald" | "amber" | "sky";
}) {
  const pCal = value * (color === "amber" ? 9 : 4);
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full ${MACRO_COLORS[color]}`} />
      <span className="text-xs text-muted/70 w-8">{label}</span>
      <span className="text-xs text-foreground/90">
        {round1(value)}{unit}
      </span>
      <span className="text-[10px] text-muted/40 ml-auto">{Math.round(pCal)} kcal</span>
    </div>
  );
}
