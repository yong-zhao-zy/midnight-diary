import { createAiFood, FOOD_SELECT, type AiFoodInput, type FoodRow } from "@/lib/food-service";
import type { SupabaseClient } from "@supabase/supabase-js";

export const FOOD_ESTIMATE_SYSTEM_PROMPT = `你是营养数据库。用户输入任意中文食物名，你输出该食物每 100g 可食部分的营养数据。

输入可能是：
- 单一食材（如「红薯」「鸡蛋」）
- 含烹饪方式的食材（如「煮红薯」「蒸鸡蛋」「烤鸡腿」）
- 品牌加工食品（如「康师傅红烧牛肉面」「伊利纯牛奶」）
- 菜名（如「宫保鸡丁」「番茄炒蛋」「红烧肉」）

输出严格 JSON，不要解释，不要 markdown 代码块。字段如下：
{
  "name": "中文名（保留用户输入的烹饪方式）",
  "energy_kcal": 数值,
  "protein_g": 数值,
  "fat_g": 数值,
  "carb_g": 数值,
  "fiber_g": 数值,
  "sodium_mg": 数值,
  "potassium_mg": 数值,
  "calcium_mg": 数值,
  "magnesium_mg": 数值,
  "iron_mg": 数值,
  "zinc_mg": 数值,
  "selenium_ug": 数值,
  "vit_a_ugre": 数值或null,
  "vit_b1_mg": 数值或null,
  "vit_b2_mg": 数值或null,
  "vit_b6_mg": 数值或null,
  "vit_b12_ug": 数值或null,
  "vit_c_mg": 数值或null,
  "vit_d_ug": 数值或null,
  "vit_e_mg": 数值或null,
  "default_serving_g": 一份常见克数,
  "default_serving_name": "一份描述（如 一盘/一碗/一个/一包）"
}

数据规则：
- 宏量营养素（energy/protein/fat/carb/fiber/sodium/potassium/calcium/magnesium/iron/zinc/selenium）必须有值，基于中国食物成分表常见值或合理估算。
- 微量营养素（vit_a 到 vit_e）若该食物确实缺乏或无可靠数据，填 null，不要编造。
- 数值基于「每 100g 可食部分」，注意烹饪方式影响水分和密度：煮/蒸后水分增加、热量密度下降；烤/炸后水分减少、热量密度上升；炒菜吸油、fat 上升。
- default_serving_g 是该食物一份的常见克数（如一盘宫保鸡丁约 250g、一碗米饭约 150g、一个鸡蛋约 50g）。
- default_serving_name 用最自然的量词（盘/碗/个/包/杯/份）。

正确性自检：
- |protein×4 + fat×9 + carb×4 − energy_kcal| 应在 energy_kcal 的 ±30% 以内。
- protein_g + fat_g + carb_g + fiber_g ≤ 100。
- energy_kcal ∈ [5, 900]，default_serving_g ∈ [5, 2000]。`;

interface ParsedAiFood {
  name: string;
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

export interface ValidationResult {
  valid: boolean;
  food?: ParsedAiFood;
  error?: string;
}

/** 规则校验 AI 估算结果，拦截离谱值 */
export function validateAiFood(data: unknown): ValidationResult {
  if (!data || typeof data !== "object") {
    return { valid: false, error: "返回非对象" };
  }
  const d = data as Record<string, unknown>;

  const name = typeof d.name === "string" ? d.name.trim() : "";
  if (!name) {
    return { valid: false, error: "name 缺失或为空" };
  }

  const num = (k: string): number | null => {
    const v = d[k];
    if (v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const energy = num("energy_kcal");
  const protein = num("protein_g");
  const fat = num("fat_g");
  const carb = num("carb_g");
  const fiber = num("fiber_g");
  const servingG = num("default_serving_g");
  const servingName = typeof d.default_serving_name === "string" ? d.default_serving_name.trim() : "";

  if (energy === null || protein === null || fat === null || carb === null || fiber === null) {
    return { valid: false, error: "宏量营养素缺失" };
  }
  if (servingG === null || !servingName) {
    return { valid: false, error: "默认份量缺失" };
  }

  if (energy < 5 || energy > 900) {
    return { valid: false, error: `energy_kcal ${energy} 超出 [5, 900]` };
  }
  if (protein > 100 || fat > 100 || carb > 100) {
    return { valid: false, error: "宏量单项 >100g" };
  }
  if (protein + fat + carb + fiber > 100) {
    return { valid: false, error: `营养素总和 ${protein + fat + carb + fiber} >100g` };
  }
  const macroEnergy = protein * 4 + fat * 9 + carb * 4;
  if (Math.abs(macroEnergy - energy) > energy * 0.3) {
    return { valid: false, error: `宏量守恒失败: ${macroEnergy} vs ${energy}` };
  }
  if (servingG < 5 || servingG > 2000) {
    return { valid: false, error: `default_serving_g ${servingG} 超出 [5, 2000]` };
  }

  return {
    valid: true,
    food: {
      name,
      energy_kcal: energy,
      protein_g: protein,
      fat_g: fat,
      carb_g: carb,
      fiber_g: fiber,
      sodium_mg: num("sodium_mg"),
      potassium_mg: num("potassium_mg"),
      calcium_mg: num("calcium_mg"),
      magnesium_mg: num("magnesium_mg"),
      iron_mg: num("iron_mg"),
      zinc_mg: num("zinc_mg"),
      selenium_ug: num("selenium_ug"),
      vit_a_ugre: num("vit_a_ugre"),
      vit_b1_mg: num("vit_b1_mg"),
      vit_b2_mg: num("vit_b2_mg"),
      vit_b6_mg: num("vit_b6_mg"),
      vit_b12_ug: num("vit_b12_ug"),
      vit_c_mg: num("vit_c_mg"),
      vit_d_ug: num("vit_d_ug"),
      vit_e_mg: num("vit_e_mg"),
      default_serving_g: servingG,
      default_serving_name: servingName,
    },
  };
}

function stripCodeFences(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*\n?/, "")
      .replace(/\n?```\s*$/, "");
  }
  return cleaned.trim();
}

/** 调 DeepSeek 估算食物营养 */
export async function estimateFoodWithAI(query: string): Promise<ParsedAiFood | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.error("estimateFoodWithAI: DEEPSEEK_API_KEY not set");
    return null;
  }

  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: FOOD_ESTIMATE_SYSTEM_PROMPT },
          { role: "user", content: query },
        ],
        temperature: 0.3,
        max_tokens: 700,
      }),
    });

    if (!res.ok) {
      console.error("DeepSeek API error:", res.status, await res.text());
      return null;
    }

    const json = await res.json();
    const raw = json.choices?.[0]?.message?.content ?? "";
    const cleaned = stripCodeFences(raw);

    const parsed = JSON.parse(cleaned) as unknown;
    return parsed as ParsedAiFood;
  } catch (err) {
    console.error("estimateFoodWithAI error:", err);
    return null;
  }
}

/** 编排：估算 → 校验 → 存库 → 返回 FoodRow */
export async function estimateAndStoreFood(
  query: string,
  userId: string,
  supabase: SupabaseClient
): Promise<FoodRow | null> {
  const estimated = await estimateFoodWithAI(query);
  if (!estimated) return null;

  const { valid, food, error } = validateAiFood(estimated);
  if (!valid || !food) {
    console.error("AI food validation failed:", error, "query:", query);
    return null;
  }

  const aiFoodInput: AiFoodInput = {
    userId,
    name: food.name,
    energy_kcal: food.energy_kcal,
    protein_g: food.protein_g,
    fat_g: food.fat_g,
    carb_g: food.carb_g,
    fiber_g: food.fiber_g,
    sodium_mg: food.sodium_mg,
    potassium_mg: food.potassium_mg,
    calcium_mg: food.calcium_mg,
    magnesium_mg: food.magnesium_mg,
    iron_mg: food.iron_mg,
    zinc_mg: food.zinc_mg,
    selenium_ug: food.selenium_ug,
    vit_a_ugre: food.vit_a_ugre,
    vit_b1_mg: food.vit_b1_mg,
    vit_b2_mg: food.vit_b2_mg,
    vit_b6_mg: food.vit_b6_mg,
    vit_b12_ug: food.vit_b12_ug,
    vit_c_mg: food.vit_c_mg,
    vit_d_ug: food.vit_d_ug,
    vit_e_mg: food.vit_e_mg,
    default_serving_g: food.default_serving_g,
    default_serving_name: food.default_serving_name,
  };

  const stored = await createAiFood(aiFoodInput, supabase);
  if (stored) return stored;

  // 插入失败（可能唯一约束冲突）→ 尝试查回已有 AI 食物
  const { data: existing } = await supabase
    .from("foods")
    .select(FOOD_SELECT)
    .eq("user_id", userId)
    .eq("source", "ai")
    .eq("name", food.name)
    .eq("is_deleted", false)
    .maybeSingle();

  return (existing as FoodRow | null) ?? null;
}
