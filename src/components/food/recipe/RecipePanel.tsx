"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useFoodStore } from "@/store/food-store";
import type { RecipeRow, RecipeWithIngredients } from "@/lib/recipe-service";
import { RecipeEditorSheet } from "./RecipeEditorSheet";

export function RecipePanel() {
  const recipes = useFoodStore((s) => s.recipes);
  const fetchedAt = useFoodStore((s) => s.recipesFetchedAt);
  const removeRecipe = useFoodStore((s) => s.removeRecipe);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<RecipeWithIngredients | null>(null);

  const openNew = () => {
    setEditTarget(null);
    setEditorOpen(true);
  };

  const openEdit = async (r: RecipeRow) => {
    // Fetch full recipe with ingredients via the [id] GET route
    try {
      const res = await fetch(`/api/recipes/${r.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.recipe) {
          setEditTarget(data.recipe as RecipeWithIngredients);
          setEditorOpen(true);
          return;
        }
      }
    } catch { /* fall through */ }
    setEditTarget({ ...r, ingredients: [] } as RecipeWithIngredients);
    setEditorOpen(true);
  };

  const handleDelete = async (id: string) => {
    await removeRecipe(id);
  };

  if (fetchedAt === null) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-xs text-muted/40">加载中...</p>
      </div>
    );
  }

  if (recipes.length === 0) {
    return (
      <>
        <div className="text-center py-20 space-y-3">
          <p className="text-sm text-muted/70">还没有菜谱</p>
          <p className="text-xs text-muted/40">创建菜谱，按食材自动计算营养</p>
        </div>
        <button
          onClick={openNew}
          className="fixed bottom-8 right-8 flex h-12 w-12 items-center justify-center rounded-full bg-glow-gold shadow-lg shadow-glow-gold/25 text-midnight hover:scale-105 active:scale-95 transition-transform z-40"
          aria-label="新建菜谱"
        >
          <Plus className="h-5 w-5" strokeWidth={2.5} />
        </button>
        <RecipeEditorSheet open={editorOpen} onOpenChange={setEditorOpen} editTarget={editTarget} />
      </>
    );
  }

  return (
    <>
      <div className="space-y-3 pb-20">
        {recipes.map((r) => (
          <div key={r.id} className="rounded-xl bg-white/[0.03] border border-white/8 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground/90">{r.name}</p>
                <p className="text-xs text-muted/40 mt-0.5">{r.servings} 人份{r.description ? ` · ${r.description}` : ""}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => openEdit(r)}
                  className="p-1.5 rounded-lg text-muted/40 hover:text-glow-gold hover:bg-white/5 transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(r.id)}
                  className="p-1.5 rounded-lg text-muted/40 hover:text-rose-400 hover:bg-white/5 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted/60 mt-2">
              <span className="text-glow-gold/70">{Math.round(r.energy_kcal_per_serving ?? 0)} kcal/份</span>
              {r.protein_g_per_serving != null && <span>蛋白 {round1(r.protein_g_per_serving)}</span>}
              {r.fat_g_per_serving != null && <span>脂肪 {round1(r.fat_g_per_serving)}</span>}
              {r.carb_g_per_serving != null && <span>碳水 {round1(r.carb_g_per_serving)}</span>}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={openNew}
        className="fixed bottom-8 right-8 flex h-12 w-12 items-center justify-center rounded-full bg-glow-gold shadow-lg shadow-glow-gold/25 text-midnight hover:scale-105 active:scale-95 transition-transform z-40"
        aria-label="新建菜谱"
      >
        <Plus className="h-5 w-5" strokeWidth={2.5} />
      </button>

      <RecipeEditorSheet open={editorOpen} onOpenChange={setEditorOpen} editTarget={editTarget} />
    </>
  );
}

function round1(n: number): number {
  return Math.round((Number(n) || 0) * 10) / 10;
}
