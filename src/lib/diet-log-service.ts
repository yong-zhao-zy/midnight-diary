import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getFoodById, FOOD_SELECT, type FoodRow } from "./food-service";

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export interface DietLogRow {
  id: string;
  user_id: string;
  log_date: string;
  meal_type: MealType;
  food_id: string | null;
  recipe_id: string | null;
  servings: number;
  quantity_g: number | null;
  energy_kcal: number;
  protein_g: number;
  fat_g: number;
  carb_g: number;
  fiber_g: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface DietLogWithNames extends DietLogRow {
  food_name: string | null;
  recipe_name: string | null;
}

export interface CreateDietLogInput {
  userId: string;
  log_date: string;
  meal_type: MealType;
  food_id?: string;
  recipe_id?: string;
  servings?: number;
  quantity_g?: number;
  note?: string;
}

export interface UpdateDietLogInput {
  servings?: number;
  quantity_g?: number;
  meal_type?: MealType;
  note?: string;
}

export const DIET_LOG_SELECT =
  "id, user_id, log_date, meal_type, food_id, recipe_id, servings, quantity_g, energy_kcal, protein_g, fat_g, carb_g, fiber_g, note, created_at, updated_at";

const DIET_LOG_SELECT_WITH_NAMES = `${DIET_LOG_SELECT}, food:foods(name), recipe:recipes(name)`;

/** recipe 表中计算冻结营养素所需的最小字段集（避免依赖 recipe-service 尚未创建） */
interface RecipeNutritionSnapshot {
  energy_kcal_per_serving: number | null;
  protein_g_per_serving: number | null;
  fat_g_per_serving: number | null;
  carb_g_per_serving: number | null;
  fiber_g_per_serving: number | null;
}

interface FrozenNutrition {
  energy_kcal: number;
  protein_g: number;
  fat_g: number;
  carb_g: number;
  fiber_g: number;
}

const ZERO_NUTRITION: FrozenNutrition = {
  energy_kcal: 0,
  protein_g: 0,
  fat_g: 0,
  carb_g: 0,
  fiber_g: 0,
};

/**
 * 计算冻结营养素快照。
 * - food 有值：ratio = (quantityG ?? food.default_serving_g × servings) / 100，每个营养素 = food.nutrient × ratio
 * - recipe 有值：每个营养素 = recipe.xxx_per_serving × servings
 */
function calcFrozenNutrition(
  food: FoodRow | null,
  recipe: RecipeNutritionSnapshot | null,
  servings: number,
  quantityG: number | null
): FrozenNutrition {
  if (food) {
    const effectiveQty = quantityG ?? food.default_serving_g * servings;
    const ratio = effectiveQty / 100;
    return {
      energy_kcal: round2(food.energy_kcal * ratio),
      protein_g: round2(food.protein_g * ratio),
      fat_g: round2(food.fat_g * ratio),
      carb_g: round2(food.carb_g * ratio),
      fiber_g: round2(food.fiber_g * ratio),
    };
  }

  if (recipe) {
    return {
      energy_kcal: round2((recipe.energy_kcal_per_serving ?? 0) * servings),
      protein_g: round2((recipe.protein_g_per_serving ?? 0) * servings),
      fat_g: round2((recipe.fat_g_per_serving ?? 0) * servings),
      carb_g: round2((recipe.carb_g_per_serving ?? 0) * servings),
      fiber_g: round2((recipe.fiber_g_per_serving ?? 0) * servings),
    };
  }

  return { ...ZERO_NUTRITION };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function fetchRecipeNutrition(
  recipeId: string,
  supabase: SupabaseClient
): Promise<RecipeNutritionSnapshot | null> {
  const { data, error } = await supabase
    .from("recipes")
    .select("energy_kcal_per_serving, protein_g_per_serving, fat_g_per_serving, carb_g_per_serving, fiber_g_per_serving")
    .eq("id", recipeId)
    .eq("is_deleted", false)
    .single();

  if (error || !data) {
    console.error("Fetch recipe nutrition error:", error);
    return null;
  }
  return data as RecipeNutritionSnapshot;
}

/** 获取指定日期的所有饮食记录（含食物/菜谱名称） */
export async function fetchDietLogsByDate(
  userId: string,
  date: string,
  supabase: SupabaseClient = createClient()
): Promise<DietLogWithNames[]> {
  const { data, error } = await supabase
    .from("diet_logs")
    .select(DIET_LOG_SELECT_WITH_NAMES)
    .eq("user_id", userId)
    .eq("log_date", date)
    .eq("is_deleted", false)
    .order("meal_type", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Fetch diet logs by date error:", error);
    return [];
  }

  return (data ?? []).map((row) => {
    const { food, recipe, ...rest } = row as Record<string, unknown>;
    return {
      ...rest,
      food_name: (food as { name: string } | null)?.name ?? null,
      recipe_name: (recipe as { name: string } | null)?.name ?? null,
    } as DietLogWithNames;
  });
}

/** 获取日期范围内的饮食记录（分析报告用，不含名称） */
export async function fetchDietLogsByRange(
  userId: string,
  startDate: string,
  endDate: string,
  supabase: SupabaseClient = createClient()
): Promise<DietLogRow[]> {
  const { data, error } = await supabase
    .from("diet_logs")
    .select(DIET_LOG_SELECT)
    .eq("user_id", userId)
    .eq("is_deleted", false)
    .gte("log_date", startDate)
    .lte("log_date", endDate)
    .order("log_date", { ascending: true })
    .order("meal_type", { ascending: true });

  if (error) {
    console.error("Fetch diet logs by range error:", error);
    return [];
  }

  return (data ?? []) as DietLogRow[];
}

/** 创建饮食记录，自动计算冻结营养素 */
export async function createDietLog(
  input: CreateDietLogInput,
  supabase: SupabaseClient = createClient()
): Promise<DietLogWithNames | null> {
  const servings = input.servings ?? 1;

  if (!input.food_id && !input.recipe_id) {
    console.error("Create diet log: food_id or recipe_id required");
    return null;
  }

  let food: FoodRow | null = null;
  let recipe: RecipeNutritionSnapshot | null = null;

  if (input.food_id) {
    food = await getFoodById(input.food_id, supabase);
    if (!food) {
      console.error("Create diet log: food not found");
      return null;
    }
  } else if (input.recipe_id) {
    recipe = await fetchRecipeNutrition(input.recipe_id, supabase);
    if (!recipe) {
      console.error("Create diet log: recipe not found");
      return null;
    }
  }

  const frozen = calcFrozenNutrition(food, recipe, servings, input.quantity_g ?? null);

  const insertPayload = {
    user_id: input.userId,
    log_date: input.log_date,
    meal_type: input.meal_type,
    food_id: input.food_id ?? null,
    recipe_id: input.recipe_id ?? null,
    servings,
    quantity_g: input.quantity_g ?? null,
    energy_kcal: frozen.energy_kcal,
    protein_g: frozen.protein_g,
    fat_g: frozen.fat_g,
    carb_g: frozen.carb_g,
    fiber_g: frozen.fiber_g,
    note: input.note ?? null,
  };

  const { data, error } = await supabase
    .from("diet_logs")
    .insert(insertPayload)
    .select(DIET_LOG_SELECT_WITH_NAMES)
    .single();

  if (error || !data) {
    console.error("Create diet log error:", error);
    return null;
  }

  const { food: foodJoin, recipe: recipeJoin, ...rest } = data as Record<string, unknown>;
  return {
    ...rest,
    food_name: (foodJoin as { name: string } | null)?.name ?? null,
    recipe_name: (recipeJoin as { name: string } | null)?.name ?? null,
  } as DietLogWithNames;
}

/** 更新饮食记录（修改份数/重量时重算冻结营养素） */
export async function updateDietLog(
  id: string,
  patch: UpdateDietLogInput,
  supabase: SupabaseClient = createClient()
): Promise<DietLogRow | null> {
  const { data: existing, error: fetchErr } = await supabase
    .from("diet_logs")
    .select(DIET_LOG_SELECT)
    .eq("id", id)
    .eq("is_deleted", false)
    .single();

  if (fetchErr || !existing) {
    console.error("Update diet log — not found:", fetchErr);
    return null;
  }

  const current = existing as DietLogRow;
  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (patch.meal_type !== undefined) updatePayload.meal_type = patch.meal_type;
  if (patch.note !== undefined) updatePayload.note = patch.note;

  const needsRecompute =
    patch.servings !== undefined || patch.quantity_g !== undefined;

  if (needsRecompute) {
    const servings = patch.servings ?? current.servings;
    const quantityG = patch.quantity_g ?? current.quantity_g;

    let food: FoodRow | null = null;
    let recipe: RecipeNutritionSnapshot | null = null;

    if (current.food_id) {
      food = await getFoodById(current.food_id, supabase);
    } else if (current.recipe_id) {
      recipe = await fetchRecipeNutrition(current.recipe_id, supabase);
    }

    const frozen = calcFrozenNutrition(food, recipe, servings, quantityG);
    updatePayload.servings = servings;
    updatePayload.quantity_g = quantityG;
    updatePayload.energy_kcal = frozen.energy_kcal;
    updatePayload.protein_g = frozen.protein_g;
    updatePayload.fat_g = frozen.fat_g;
    updatePayload.carb_g = frozen.carb_g;
    updatePayload.fiber_g = frozen.fiber_g;
  }

  const { data, error } = await supabase
    .from("diet_logs")
    .update(updatePayload)
    .eq("id", id)
    .select(DIET_LOG_SELECT)
    .single();

  if (error || !data) {
    console.error("Update diet log error:", error);
    return null;
  }

  return data as DietLogRow;
}

/** 软删除饮食记录 */
export async function softDeleteDietLog(
  id: string,
  supabase: SupabaseClient = createClient()
): Promise<boolean> {
  const { error } = await supabase
    .from("diet_logs")
    .update({ deleted_at: new Date().toISOString(), is_deleted: true })
    .eq("id", id);

  if (error) {
    console.error("Delete diet log error:", error);
    return false;
  }
  return true;
}

/**
 * 获取指定餐次最常食用的食物（按历史 diet_logs 统计频次降序）。
 * 拉取最近 100 条该餐次记录，JOIN foods 取完整 FoodRow，按 food_id 计数去重后取 top N。
 * 软删/RLS 不可见的食物在 JOIN 时为 null，自动跳过。
 */
export async function fetchFrequentFoods(
  userId: string,
  mealType: MealType,
  limit: number = 8,
  supabase: SupabaseClient = createClient()
): Promise<FoodRow[]> {
  const { data, error } = await supabase
    .from("diet_logs")
    .select(`food_id, food:foods(${FOOD_SELECT})`)
    .eq("user_id", userId)
    .eq("meal_type", mealType)
    .eq("is_deleted", false)
    .not("food_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Fetch frequent foods error:", error);
    return [];
  }

  const counts = new Map<string, { food: FoodRow; count: number }>();
  for (const row of (data ?? []) as unknown as Array<{ food_id: string; food: FoodRow | null }>) {
    if (!row.food) continue;
    const existing = counts.get(row.food_id);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(row.food_id, { food: row.food, count: 1 });
    }
  }

  return [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((v) => v.food);
}
