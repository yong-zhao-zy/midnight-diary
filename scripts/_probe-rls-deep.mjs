/**
 * RLS 深度探针：定位 UPDATE 被 WITH CHECK 拒绝的真实原因。
 * A. 打印 session uid 与行内 user_id 是否一致
 * B. 改普通字段（name）是否也被拒 → 区分「策略针对 is_deleted」还是「一切 UPDATE 都被拒」
 * C. 软删 UPDATE 是否被拒
 * 结束后 service_role 硬删清理。
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
  const uid = sess.user.id;
  const jwtSub = JSON.parse(Buffer.from(sess.session.access_token.split(".")[1], "base64url").toString()).sub;
  console.log("session uid :", uid);
  console.log("JWT sub     :", jwtSub, uid === jwtSub ? "✓ 一致" : "✗ 不一致");

  // 建行
  const { data: rec, error: rErr } = await user
    .from("recipes")
    .insert({ user_id: uid, name: "__probe2__", servings: 1 })
    .select("id, user_id")
    .single();
  if (rErr) throw new Error("建菜谱失败: " + rErr.message);
  made.push(rec.id);
  const { data: dbRow0 } = await admin.from("recipes").select("user_id").eq("id", rec.id).single();
  console.log("DB 行 user_id:", dbRow0?.user_id, dbRow0?.user_id === uid ? "✓ 等于登录用户" : "✗ 不等于登录用户");

  // A. 改普通字段
  const { data: a, error: aErr } = await user.from("recipes").update({ name: "__probe2_renamed__" }).eq("id", rec.id).select("id");
  console.log(`\nA 改 name      → error: ${aErr?.message ?? "null"}  行数: ${a?.length ?? "null"}`);

  // B. 软删
  const { data: b, error: bErr } = await user
    .from("recipes")
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq("id", rec.id)
    .select("id");
  console.log(`B 软删(is_deleted) → error: ${bErr?.message ?? "null"}  行数: ${b?.length ?? "null"}`);

  // C. 只改 deleted_at，不动 is_deleted
  const { data: c, error: cErr } = await user
    .from("recipes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", rec.id)
    .select("id");
  console.log(`C 只改 deleted_at → error: ${cErr?.message ?? "null"}  行数: ${c?.length ?? "null"}`);

  // D. 物理 DELETE（验证 DELETE 策略是否正常）
  const { error: dErr } = await user.from("recipes").delete().eq("id", rec.id);
  console.log(`D 物理 DELETE  → error: ${dErr?.message ?? "null"}`);
  const { data: after } = await admin.from("recipes").select("id").eq("id", rec.id);
  console.log(`   DB 中该行: ${after?.length ? "仍存在" : "已删除"}`);
} catch (e) {
  console.error("探针异常:", e.message);
} finally {
  for (const id of made) {
    await admin.from("recipes").delete().eq("id", id);
  }
  console.log("\n[cleanup] 探针数据已清理");
}
