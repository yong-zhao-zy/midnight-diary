import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FoodRow } from "./food-service";
import { FOOD_SELECT } from "./food-service";

export interface RecipeRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  servings: number;
  instructions: string | null;
  energy_kcal_per_serving: number | null;
  protein_g_per_serving: number | null;
  fat_g_per_serving: number | null;
  carb_g_per_serving: number | null;
  fiber_g_per_serving: number | null;
  created_at: string;
  updated_at: string;
}

export interface RecipeIngredientRow {
  id: string;
  recipe_id: string;
  food_id: string;
  user_id: string;
  quantity_g: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecipeWithIngredients extends RecipeRow {
  ingredients: (RecipeIngredientRow & { food: FoodRow })[];
}

export interface CreateRecipeInput {
  userId: string;
  name: string;
  description?: string;
  servings: number;
  instructions?: string;
  ingredients: Array<{ food_id: string; quantity_g: number; note?: string }>;
}

export interface UpdateRecipeInput {
  name?: string;
  description?: string;
  servings?: number;
  instructions?: string;
  ingredients?: Array<{ food_id: string; quantity_g: number; note?: string }>;
}

export const RECIPE_SELECT =
  "id, user_id, name, description, servings, instructions, energy_kcal_per_serving, protein_g_per_serving, fat_g_per_serving, carb_g_per_serving, fiber_g_per_serving, created_at, updated_at";

export const RI_SELECT =
  "id, recipe_id, food_id, user_id, quantity_g, note, created_at, updated_at";

/** 微量营养素字段列表 */
const MICRO_FIELDS = [
  "sodium_mg",
  "potassium_mg",
  "calcium_mg",
  "magnesium_mg",
  "iron_mg",
  "zinc_mg",
  "selenium_ug",
  "vit_a_ugre",
  "vit_b1_mg",
  "vit_b2_mg",
  "vit_b6_mg",
  "vit_b12_ug",
  "vit_c_mg",
  "vit_d_ug",
  "vit_e_mg",
] as const;

/** 宏量营养素字段列表 */
const MACRO_FIELDS = [
  "energy_kcal",
  "protein_g",
  "fat_g",
  "carb_g",
  "fiber_g",
] as const;

export interface RecipeNutrition {
  energy_kcal: number;
  protein_g: number;
  fat_g: number;
  carb_g: number;
  fiber_g: number;
  sodium_mg: number | null;
  potassium_mg: number | null;
  calcium_mg: number | null;
  magnesium_mg: number | null;
  iron_mg: number | null;
  zinc_mg: number | null;
  selenium_ug: number | null;
  vit_a_ugre: number | null;
  vit_b1_mg: number | null;
  vit_b2_mg: number | null;
  vit_b6_mg: number | null;
  vit_b12_ug: number | null;
  vit_c_mg: number | null;
  vit_d_ug: number | null;
  vit_e_mg: number | null;
}

/**
 * 核心计算逻辑：根据食材明细 + foods 营养素，计算每份菜谱的营养素。
 * 营养素 = Σ(food.nutrient_per_100g × quantity_g / 100) / servings
 * 食物微量为 null 时，该菜谱对应微量也为 null（不按 0 计算）
 */
export function calculateRecipeNutrition(
  ingredients: Array<{ quantity_g: number; food: FoodRow }>,
  servings: number
): RecipeNutrition {
  if (servings <= 0) servings = 1;

  const result = {} as RecipeNutrition;

  // 宏量：food 一定有值（NOT NULL），直接求和
  for (const field of MACRO_FIELDS) {
    const total = ingredients.reduce((sum, ing) => {
      const val = ing.food[field] as number;
      return sum + (val * ing.quantity_g) / 100;
    }, 0);
    result[field] = Math.round((total / servings) * 100) / 100;
  }

  // 微量：任一食材为 null 则整体 null
  for (const field of MICRO_FIELDS) {
    const hasNull = ingredients.some((ing) => ing.food[field] == null);
    if (hasNull || ingredients.length === 0) {
      result[field] = null;
    } else {
      const total = ingredients.reduce((sum, ing) => {
        const val = ing.food[field] as number;
        return sum + (val * ing.quantity_g) / 100;
      }, 0);
      result[field] = Math.round((total / servings) * 100) / 100;
    }
  }

  return result;
}

/** 获取用户所有菜谱（不含食材明细，列表用） */
export async function fetchRecipes(
  userId: string,
  supabase: SupabaseClient = createClient()
): Promise<RecipeRow[]> {
  const { data, error } = await supabase
    .from("recipes")
    .select(RECIPE_SELECT)
    .eq("user_id", userId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Fetch recipes error:", error);
    return [];
  }
  return (data ?? []) as RecipeRow[];
}

/** 获取单个菜谱详情（含食材+食物营养） */
export async function getRecipeWithIngredients(
  recipeId: string,
  userId: string,
  supabase: SupabaseClient = createClient()
): Promise<RecipeWithIngredients | null> {
  const { data: recipe, error: recipeErr } = await supabase
    .from("recipes")
    .select(RECIPE_SELECT)
    .eq("id", recipeId)
    .eq("user_id", userId)
    .eq("is_deleted", false)
    .single();

  if (recipeErr || !recipe) {
    console.error("Get recipe error:", recipeErr);
    return null;
  }

  const { data: ingredients, error: ingErr } = await supabase
    .from("recipe_ingredients")
    .select(RI_SELECT)
    .eq("recipe_id", recipeId)
    .eq("user_id", userId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: true });

  if (ingErr) {
    console.error("Get recipe ingredients error:", ingErr);
    return { ...recipe, ingredients: [] } as RecipeWithIngredients;
  }

  // 嵌套查每个食材对应的 food
  const enrichedIngredients = await Promise.all(
    (ingredients ?? []).map(async (ing) => {
      const { data: food } = await supabase
        .from("foods")
        .select(FOOD_SELECT)
        .eq("id", ing.food_id)
        .eq("is_deleted", false)
        .single();
      return { ...ing, food: food as FoodRow } as RecipeIngredientRow & { food: FoodRow };
    })
  );

  return { ...recipe, ingredients: enrichedIngredients } as RecipeWithIngredients;
}

/** 创建菜谱 + 食材明细，并自动计算每份营养素缓存 */
export async function createRecipe(
  input: CreateRecipeInput,
  supabase: SupabaseClient = createClient()
): Promise<RecipeWithIngredients | null> {
  // Step 1: INSERT recipe
  const { data: recipe, error: recipeErr } = await supabase
    .from("recipes")
    .insert({
      user_id: input.userId,
      name: input.name,
      description: input.description ?? null,
      servings: input.servings,
      instructions: input.instructions ?? null,
    })
    .select(RECIPE_SELECT)
    .single();

  if (recipeErr || !recipe) {
    console.error("Create recipe error:", recipeErr);
    return null;
  }

  // Step 2: 批量 INSERT recipe_ingredients
  const ingRows = input.ingredients.map((ing) => ({
    recipe_id: recipe.id,
    food_id: ing.food_id,
    user_id: input.userId,
    quantity_g: ing.quantity_g,
    note: ing.note ?? null,
  }));

  if (ingRows.length > 0) {
    const { error: ingErr } = await supabase
      .from("recipe_ingredients")
      .insert(ingRows);

    if (ingErr) {
      console.error("Create recipe ingredients error:", ingErr);
    }
  }

  // Step 3: 查所有 food 营养素，算营养缓存
  const foodIds = input.ingredients.map((ing) => ing.food_id);
  const foods: FoodRow[] = [];
  for (const fid of foodIds) {
    const { data: food } = await supabase
      .from("foods")
      .select(FOOD_SELECT)
      .eq("id", fid)
      .eq("is_deleted", false)
      .single();
    if (food) foods.push(food as FoodRow);
  }

  const nutrition = calculateRecipeNutrition(
    input.ingredients.map((ing, i) => ({
      quantity_g: ing.quantity_g,
      food: foods[i],
    })),
    input.servings
  );

  // Step 4: UPDATE 营养缓存回 recipe
  const { error: updateErr } = await supabase
    .from("recipes")
    .update({
      energy_kcal_per_serving: nutrition.energy_kcal,
      protein_g_per_serving: nutrition.protein_g,
      fat_g_per_serving: nutrition.fat_g,
      carb_g_per_serving: nutrition.carb_g,
      fiber_g_per_serving: nutrition.fiber_g,
      updated_at: new Date().toISOString(),
    })
    .eq("id", recipe.id);

  if (updateErr) {
    console.error("Update recipe nutrition cache error:", updateErr);
  }

  // Step 5: 返回完整对象
  return getRecipeWithIngredients(recipe.id, input.userId, supabase);
}

/** 更新菜谱（含食材明细覆盖式更新），重算营养素缓存 */
export async function updateRecipe(
  id: string,
  input: UpdateRecipeInput,
  supabase: SupabaseClient = createClient()
): Promise<RecipeWithIngredients | null> {
  // Step 1: UPDATE recipe 基础字段
  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) updatePayload.name = input.name;
  if (input.description !== undefined) updatePayload.description = input.description;
  if (input.servings !== undefined) updatePayload.servings = input.servings;
  if (input.instructions !== undefined) updatePayload.instructions = input.instructions;

  // 需要先查 recipe 拿 user_id
  const { data: existing, error: fetchErr } = await supabase
    .from("recipes")
    .select("id, user_id, servings")
    .eq("id", id)
    .eq("is_deleted", false)
    .single();

  if (fetchErr || !existing) {
    console.error("Update recipe — not found:", fetchErr);
    return null;
  }

  const { error: updateErr } = await supabase
    .from("recipes")
    .update(updatePayload)
    .eq("id", id);

  if (updateErr) {
    console.error("Update recipe error:", updateErr);
    return null;
  }

  // Step 2: 如果有 ingredients，覆盖式更新
  if (input.ingredients !== undefined) {
    // 软删旧 ingredients
    await supabase
      .from("recipe_ingredients")
      .update({ deleted_at: new Date().toISOString(), is_deleted: true })
      .eq("recipe_id", id)
      .eq("user_id", existing.user_id)
      .eq("is_deleted", false);

    // INSERT 新 ingredients
    if (input.ingredients.length > 0) {
      const ingRows = input.ingredients.map((ing) => ({
        recipe_id: id,
        food_id: ing.food_id,
        user_id: existing.user_id,
        quantity_g: ing.quantity_g,
        note: ing.note ?? null,
      }));

      const { error: ingErr } = await supabase
        .from("recipe_ingredients")
        .insert(ingRows);

      if (ingErr) {
        console.error("Update recipe ingredients error:", ingErr);
      }
    }
  }

  // Step 3: 重算营养缓存
  const fullRecipe = await getRecipeWithIngredients(id, existing.user_id, supabase);
  if (fullRecipe) {
    const servings = input.servings ?? existing.servings;
    const nutrition = calculateRecipeNutrition(
      fullRecipe.ingredients.map((ing) => ({
        quantity_g: ing.quantity_g,
        food: ing.food,
      })),
      servings
    );

    await supabase
      .from("recipes")
      .update({
        energy_kcal_per_serving: nutrition.energy_kcal,
        protein_g_per_serving: nutrition.protein_g,
        fat_g_per_serving: nutrition.fat_g,
        carb_g_per_serving: nutrition.carb_g,
        fiber_g_per_serving: nutrition.fiber_g,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
  }

  return getRecipeWithIngredients(id, existing.user_id, supabase);
}

/** 软删除菜谱（级联软删 recipe_ingredients） */
export async function softDeleteRecipe(
  id: string,
  supabase: SupabaseClient = createClient()
): Promise<boolean> {
  const now = new Date().toISOString();

  // Step 1: 软删 recipe_ingredients
  const { error: ingErr } = await supabase
    .from("recipe_ingredients")
    .update({ deleted_at: now, is_deleted: true })
    .eq("recipe_id", id)
    .eq("is_deleted", false);

  if (ingErr) {
    console.error("Soft delete recipe ingredients error:", ingErr);
  }

  // Step 2: 软删 recipe
  const { error: recipeErr } = await supabase
    .from("recipes")
    .update({ deleted_at: now, is_deleted: true })
    .eq("id", id);

  if (recipeErr) {
    console.error("Soft delete recipe error:", recipeErr);
    return false;
  }
  return true;
}
