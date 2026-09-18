import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

export type FoodSource = "system" | "user" | "ai";

export interface FoodRow {
  id: string;
  user_id: string | null;
  name: string;
  source: FoodSource;
  category: string | null;
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
  default_serving_g: number;
  default_serving_name: string;
  created_at: string;
  updated_at: string;
}

export interface CreateFoodInput {
  userId: string;
  name: string;
  category?: string;
  energy_kcal: number;
  protein_g: number;
  fat_g: number;
  carb_g: number;
  fiber_g: number;
  default_serving_g?: number;
  default_serving_name?: string;
}

export interface AiFoodInput {
  userId: string;
  name: string;
  category?: string;
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
  default_serving_g: number;
  default_serving_name: string;
}

export const FOOD_SELECT =
  "id, user_id, name, source, category, energy_kcal, protein_g, fat_g, carb_g, fiber_g, sodium_mg, potassium_mg, calcium_mg, magnesium_mg, iron_mg, zinc_mg, selenium_ug, vit_a_ugre, vit_b1_mg, vit_b2_mg, vit_b6_mg, vit_b12_ug, vit_c_mg, vit_d_ug, vit_e_mg, default_serving_g, default_serving_name, created_at, updated_at";

/** 搜索食物库（system + user 自定义），按名称模糊匹配 */
export async function searchFoods(
  userId: string,
  query: string,
  limit: number = 20,
  supabase: SupabaseClient = createClient()
): Promise<FoodRow[]> {
  const q = query.trim();
  if (!q) return [];

  const { data, error } = await supabase
    .from("foods")
    .select(FOOD_SELECT)
    .eq("is_deleted", false)
    .or(`source.eq.system,and(source.eq.user,user_id.eq.${userId}),and(source.eq.ai,user_id.eq.${userId})`)
    .ilike("name", `%${q}%`)
    .order("source", { ascending: true })
    .order("name", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("Search foods error:", error);
    return [];
  }
  return (data ?? []) as FoodRow[];
}

/** 获取用户自定义食物列表 */
export async function fetchUserFoods(
  userId: string,
  supabase: SupabaseClient = createClient()
): Promise<FoodRow[]> {
  const { data, error } = await supabase
    .from("foods")
    .select(FOOD_SELECT)
    .eq("user_id", userId)
    .eq("source", "user")
    .eq("is_deleted", false)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Fetch user foods error:", error);
    return [];
  }
  return (data ?? []) as FoodRow[];
}

/** 按 ID 获取单个食物 */
export async function getFoodById(
  id: string,
  supabase: SupabaseClient = createClient()
): Promise<FoodRow | null> {
  const { data, error } = await supabase
    .from("foods")
    .select(FOOD_SELECT)
    .eq("id", id)
    .eq("is_deleted", false)
    .single();

  if (error) {
    console.error("Get food by id error:", error);
    return null;
  }
  return data as FoodRow | null;
}

/** 创建用户自定义食物（source='user'） */
export async function createFood(
  input: CreateFoodInput,
  supabase: SupabaseClient = createClient()
): Promise<FoodRow | null> {
  const payload = {
    user_id: input.userId,
    name: input.name,
    source: "user" as const,
    category: input.category ?? null,
    energy_kcal: input.energy_kcal,
    protein_g: input.protein_g,
    fat_g: input.fat_g,
    carb_g: input.carb_g,
    fiber_g: input.fiber_g,
    default_serving_g: input.default_serving_g ?? 100,
    default_serving_name: input.default_serving_name ?? "100g",
  };

  const { data, error } = await supabase
    .from("foods")
    .insert(payload)
    .select(FOOD_SELECT)
    .single();

  if (error) {
    console.error("Create food error:", error);
    return null;
  }
  return data as FoodRow;
}

/** 创建 AI 估算食物（source='ai'，含全部 20 营养素） */
export async function createAiFood(
  input: AiFoodInput,
  supabase: SupabaseClient = createClient()
): Promise<FoodRow | null> {
  const payload = {
    user_id: input.userId,
    name: input.name,
    source: "ai" as const,
    category: input.category ?? null,
    energy_kcal: input.energy_kcal,
    protein_g: input.protein_g,
    fat_g: input.fat_g,
    carb_g: input.carb_g,
    fiber_g: input.fiber_g,
    sodium_mg: input.sodium_mg,
    potassium_mg: input.potassium_mg,
    calcium_mg: input.calcium_mg,
    magnesium_mg: input.magnesium_mg,
    iron_mg: input.iron_mg,
    zinc_mg: input.zinc_mg,
    selenium_ug: input.selenium_ug,
    vit_a_ugre: input.vit_a_ugre,
    vit_b1_mg: input.vit_b1_mg,
    vit_b2_mg: input.vit_b2_mg,
    vit_b6_mg: input.vit_b6_mg,
    vit_b12_ug: input.vit_b12_ug,
    vit_c_mg: input.vit_c_mg,
    vit_d_ug: input.vit_d_ug,
    vit_e_mg: input.vit_e_mg,
    default_serving_g: input.default_serving_g,
    default_serving_name: input.default_serving_name,
  };

  const { data, error } = await supabase
    .from("foods")
    .insert(payload)
    .select(FOOD_SELECT)
    .single();

  if (error) {
    console.error("Create AI food error:", error);
    return null;
  }
  return data as FoodRow;
}

/** 更新用户自定义食物（仅 user/ai source 可改） */
export async function updateFood(
  id: string,
  patch: Partial<CreateFoodInput>,
  supabase: SupabaseClient = createClient()
): Promise<FoodRow | null> {
  // 先查 source，system 食物不可改
  const { data: existing, error: fetchErr } = await supabase
    .from("foods")
    .select("source")
    .eq("id", id)
    .eq("is_deleted", false)
    .single();

  if (fetchErr || !existing) {
    console.error("Update food — not found:", fetchErr);
    return null;
  }
  if (existing.source === "system") {
    console.error("Update food — system food cannot be modified");
    return null;
  }

  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) updatePayload.name = patch.name;
  if (patch.category !== undefined) updatePayload.category = patch.category;
  if (patch.energy_kcal !== undefined) updatePayload.energy_kcal = patch.energy_kcal;
  if (patch.protein_g !== undefined) updatePayload.protein_g = patch.protein_g;
  if (patch.fat_g !== undefined) updatePayload.fat_g = patch.fat_g;
  if (patch.carb_g !== undefined) updatePayload.carb_g = patch.carb_g;
  if (patch.fiber_g !== undefined) updatePayload.fiber_g = patch.fiber_g;
  if (patch.default_serving_g !== undefined) updatePayload.default_serving_g = patch.default_serving_g;
  if (patch.default_serving_name !== undefined) updatePayload.default_serving_name = patch.default_serving_name;

  const { data, error } = await supabase
    .from("foods")
    .update(updatePayload)
    .eq("id", id)
    .select(FOOD_SELECT)
    .single();

  if (error) {
    console.error("Update food error:", error);
    return null;
  }
  return data as FoodRow;
}

/** 软删除用户自定义食物（仅 user source 可删） */
export async function softDeleteFood(
  id: string,
  supabase: SupabaseClient = createClient()
): Promise<boolean> {
  // 先查 source，system 食物不可删
  const { data: existing, error: fetchErr } = await supabase
    .from("foods")
    .select("source")
    .eq("id", id)
    .eq("is_deleted", false)
    .single();

  if (fetchErr || !existing) {
    console.error("Delete food — not found:", fetchErr);
    return false;
  }
  if (existing.source === "system") {
    console.error("Delete food — system food cannot be deleted");
    return false;
  }

  const { error } = await supabase
    .from("foods")
    .update({ deleted_at: new Date().toISOString(), is_deleted: true })
    .eq("id", id);

  if (error) {
    console.error("Delete food error:", error);
    return false;
  }
  return true;
}
