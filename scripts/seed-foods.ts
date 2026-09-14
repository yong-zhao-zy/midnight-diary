/**
 * 食物库种子数据导入脚本
 * 用法: npx tsx scripts/seed-foods.ts
 *
 * 从 scripts/data/foods-seed.json 读取食材数据，用 admin client 批量 upsert 到 foods 表。
 * 所有记录 source='system', user_id=NULL。
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env.local");
const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    process.env[match[1].trim()] = match[2].trim();
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("缺少环境变量 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY");
  console.error("请确认 .env.local 文件存在并包含这两个变量");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const MICRO_FIELDS = [
  "sodium_mg", "potassium_mg", "calcium_mg", "magnesium_mg",
  "iron_mg", "zinc_mg", "selenium_ug",
  "vit_a_ugre", "vit_b1_mg", "vit_b2_mg", "vit_b6_mg",
  "vit_b12_ug", "vit_c_mg", "vit_d_ug", "vit_e_mg",
] as const;

interface SeedFood {
  name: string;
  category: string;
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

async function main() {
  const foodsPath = resolve(process.cwd(), "scripts/data/foods-seed.json");
  console.log(`读取种子数据: ${foodsPath}`);

  const foods: SeedFood[] = JSON.parse(readFileSync(foodsPath, "utf-8"));
  console.log(`共 ${foods.length} 种食材`);

  // 转换为数据库行格式
  const rows = foods.map((f) => ({
    name: f.name,
    source: "system" as const,
    user_id: null,
    category: f.category,
    energy_kcal: f.energy_kcal,
    protein_g: f.protein_g,
    fat_g: f.fat_g,
    carb_g: f.carb_g,
    fiber_g: f.fiber_g,
    sodium_mg: f.sodium_mg,
    potassium_mg: f.potassium_mg,
    calcium_mg: f.calcium_mg,
    magnesium_mg: f.magnesium_mg,
    iron_mg: f.iron_mg,
    zinc_mg: f.zinc_mg,
    selenium_ug: f.selenium_ug,
    vit_a_ugre: f.vit_a_ugre,
    vit_b1_mg: f.vit_b1_mg,
    vit_b2_mg: f.vit_b2_mg,
    vit_b6_mg: f.vit_b6_mg,
    vit_b12_ug: f.vit_b12_ug,
    vit_c_mg: f.vit_c_mg,
    vit_d_ug: f.vit_d_ug,
    vit_e_mg: f.vit_e_mg,
    default_serving_g: f.default_serving_g,
    default_serving_name: f.default_serving_name,
  }));

  // 幂等导入：先查已存在的 system 食物名，只插入新增项（不依赖 onConflict/unique 约束）
  const { data: existing } = await supabase
    .from("foods")
    .select("name")
    .eq("source", "system");
  const existingNames = new Set((existing ?? []).map((r: { name: string }) => r.name));
  const toInsert = rows.filter((r) => !existingNames.has(r.name));
  console.log(`已存在 ${existingNames.size} 条，待插入 ${toInsert.length} 条`);

  let inserted = 0;
  let failed = 0;
  const BATCH_SIZE = 50;

  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from("foods")
      .insert(batch)
      .select("id");

    if (error) {
      console.error(`批次 ${i / BATCH_SIZE + 1} 失败:`, error.message);
      failed += batch.length;
    } else {
      inserted += data?.length ?? 0;
      console.log(`批次 ${i / BATCH_SIZE + 1}: 插入 ${data?.length ?? 0} 条`);
    }
  }

  console.log(`\n完成: 成功 ${inserted} 条, 失败 ${failed} 条`);

  // 统计微量营养素填充率
  const sample = foods.slice(0, 20);
  let microFilled = 0;
  let microTotal = 0;
  for (const f of sample) {
    for (const field of MICRO_FIELDS) {
      microTotal++;
      if (f[field] != null) microFilled++;
    }
  }
  console.log(`微量营养素填充率(前20样本): ${microFilled}/${microTotal} = ${Math.round((microFilled / microTotal) * 100)}%`);
}

main().catch((err) => {
  console.error("脚本执行失败:", err);
  process.exit(1);
});
