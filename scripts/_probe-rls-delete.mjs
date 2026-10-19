/**
 * RLS 删除行为探针：用测试账号真实复现「软删 UPDATE 是否被静默过滤」。
 * 只在测试账号下创建探针数据，结束（无论成败）用 service_role 硬删清理。
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const env = {};
for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf-8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SRK = env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(URL, SRK, { auth: { persistSession: false } });
const user = createClient(URL, ANON, { auth: { persistSession: false } });

const created = { recipes: [], diet_logs: [], recipe_ingredients: [] };

async function cleanup() {
  for (const [table, ids] of Object.entries(created)) {
    if (ids.length) {
      const { error } = await admin.from(table).delete().in("id", ids);
      console.log(`[cleanup] ${table}: ${ids.length} 行 → ${error ? "失败 " + error.message : "已删"}`);
    }
  }
}

try {
  // ── 1. 登录测试账号 ──
  const { data: sess, error: sErr } = await user.auth.signInWithPassword({
    email: "test-browse-diary@example.com",
    password: "Test1234!pass",
  });
  if (sErr) throw new Error("登录失败: " + sErr.message);
  const uid = sess.user.id;
  console.log("✓ 已登录测试账号", uid);

  // ── 2. 建菜谱探针 ──
  const { data: rec, error: rErr } = await user
    .from("recipes")
    .insert({ user_id: uid, name: "__rls_probe_recipe__", servings: 1 })
    .select("id")
    .single();
  if (rErr) throw new Error("建菜谱失败: " + rErr.message);
  created.recipes.push(rec.id);
  console.log("✓ 已建菜谱", rec.id);

  // 复现 softDeleteRecipe 的第二步（唯一决定成败的一步）
  const now = new Date().toISOString();
  const { data: updRows, error: updErr } = await user
    .from("recipes")
    .update({ deleted_at: now, is_deleted: true })
    .eq("id", rec.id)
    .select("id");
  console.log(`\n【recipes UPDATE 软删】error: ${updErr?.message ?? "null"}  返回行数: ${updRows?.length ?? "null"}`);

  // 用 service_role 看数据库里的真实状态
  const { data: dbRow } = await admin.from("recipes").select("is_deleted, deleted_at").eq("id", rec.id).single();
  console.log(`【DB 实况】is_deleted=${dbRow?.is_deleted}  deleted_at=${dbRow?.deleted_at ?? "null"}`);
  console.log(
    updRows?.length === 1 && dbRow?.is_deleted === true
      ? "✅ recipes 软删真实生效"
      : "❌ recipes 软删被静默过滤（无报错但 0 行生效）→ RLS UPDATE 策略问题"
  );

  // ── 3. 建食材探针（测 recipe_ingredients）──
  const { data: sysFood } = await admin.from("foods").select("id").eq("source", "system").limit(1).single();
  if (sysFood) {
    const { data: ing, error: iErr } = await user
      .from("recipe_ingredients")
      .insert({ user_id: uid, recipe_id: rec.id, food_id: sysFood.id, quantity_g: 100 })
      .select("id")
      .single();
    if (!iErr) {
      created.recipe_ingredients.push(ing.id);
      const { data: ingUpd } = await user
        .from("recipe_ingredients")
        .update({ deleted_at: now, is_deleted: true })
        .eq("id", ing.id)
        .select("id");
      const { data: ingDb } = await admin.from("recipe_ingredients").select("is_deleted").eq("id", ing.id).single();
      console.log(`\n【recipe_ingredients UPDATE 软删】返回行数: ${ingUpd?.length ?? "null"}  DB 实况 is_deleted=${ingDb?.is_deleted}`);
    } else {
      console.log("建食材失败:", iErr.message);
    }
  }

  // ── 4. 建饮食探针 ──
  const { data: sample } = await admin.from("diet_logs").select("*").limit(1);
  const cols = sample && sample[0] ? Object.keys(sample[0]) : [];
  console.log("\ndiet_logs 列:", cols.join(", "));
  if (sysFood) {
    const today = new Date().toISOString().slice(0, 10);
    const base = { user_id: uid, meal_type: "snack", food_id: sysFood.id, log_date: today, quantity_g: 50 };
    // 冻结营养字段若 NOT NULL，用 system food 现值填
    if (sample && sample[0]) {
      for (const k of ["kcal", "protein_g", "fat_g", "carb_g", "fiber_g", "sodium_mg"]) {
        if (cols.includes(k) && sample[0][k] != null) base[k] = 0;
      }
    }
    const { data: dl, error: dErr } = await user.from("diet_logs").insert(base).select("id").single();
    if (!dErr) {
      created.diet_logs.push(dl.id);
      const { data: dlUpd, error: dlUpdErr } = await user
        .from("diet_logs")
        .update({ deleted_at: now, is_deleted: true })
        .eq("id", dl.id)
        .select("id");
      const { data: dlDb } = await admin.from("diet_logs").select("is_deleted").eq("id", dl.id).single();
      console.log(`\n【diet_logs UPDATE 软删】error: ${dlUpdErr?.message ?? "null"}  返回行数: ${dlUpd?.length ?? "null"}  DB 实况 is_deleted=${dlDb?.is_deleted}`);
      console.log(
        dlUpd?.length === 1 && dlDb?.is_deleted === true
          ? "✅ diet_logs 软删真实生效"
          : "❌ diet_logs 软删被静默过滤 → RLS UPDATE 策略问题"
      );
    } else {
      console.log("建饮食记录失败:", dErr.message);
    }
  }
} catch (e) {
  console.error("探针异常:", e.message);
} finally {
  await cleanup();
}
