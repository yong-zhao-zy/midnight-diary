/**
 * RLS 终局探针：验证「UPDATE ... RETURNING 与 SELECT 策略交互」假设。
 *
 * 假设：UPDATE 带 .select()（= Postgres RETURNING）时，新行还必须通过
 * SELECT 策略。SELECT 策略含 is_deleted = false，软删后的新行不满足
 * → 整条语句报 "new row violates row-level security policy"。
 * 若不带 .select()（return=minimal，无 RETURNING），则只按 UPDATE 策略判定。
 *
 * 用例：
 * E. 软删 + .select()      （复现 B）
 * F. 软删 + 无 .select()   （预期 ✅ → 证实假设）
 * G. 软删 + {count:"exact"}（return=minimal + 计数，生产可用方案）
 * 结束后 service_role 清理。
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const env = {};
for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf-8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const user = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

const made = [];
try {
  const { data: sess, error: sErr } = await user.auth.signInWithPassword({
    email: "test-browse-diary@example.com",
    password: "Test1234!pass",
  });
  if (sErr) throw new Error("登录失败: " + sErr.message);

  const mk = async () => {
    const { data: rec, error } = await user
      .from("recipes")
      .insert({ user_id: sess.user.id, name: "__probe3__", servings: 1 })
      .select("id")
      .single();
    if (error) throw new Error("建菜谱失败: " + error.message);
    made.push(rec.id);
    return rec.id;
  };

  const ts = () => new Date().toISOString();

  // E. 软删 + RETURNING（复现失败）
  const idE = await mk();
  const e = await user.from("recipes").update({ is_deleted: true, deleted_at: ts() }).eq("id", idE).select("id");
  console.log(`E 软删+.select()      → error: ${e.error?.message ?? "null"}  行数: ${e.data?.length ?? "null"}`);

  // F. 软删 + 无 RETURNING
  const idF = await mk();
  const f = await user.from("recipes").update({ is_deleted: true, deleted_at: ts() }).eq("id", idF);
  console.log(`F 软删+无.select()    → error: ${f.error?.message ?? "null"}`);

  // G. 软删 + return=minimal + count=exact（生产推荐写法）
  const idG = await mk();
  const g = await user.from("recipes").update({ is_deleted: true, deleted_at: ts() }, { count: "exact" }).eq("id", idG);
  console.log(`G 软删+count:"exact"  → error: ${g.error?.message ?? "null"}  count: ${g.count ?? "null"}`);
} catch (e) {
  console.error("探针异常:", e.message);
} finally {
  for (const id of made) await admin.from("recipes").delete().eq("id", id);
  console.log("\n[cleanup] 探针数据已清理");
}
