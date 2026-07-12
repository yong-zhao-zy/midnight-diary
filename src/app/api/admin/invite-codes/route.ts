import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** 随机码生成 — 格式 MD-XXXX-XXXX-XXXX（大写字母+数字） */
function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 去除易混淆字符
  const seg = () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `MD-${seg()}-${seg()}-${seg()}`;
}

/** 统一管理员权限检查 */
async function checkAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401, msg: "未登录" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { ok: false as const, status: 403, msg: "无权访问" };
  }
  return { ok: true as const, userId: user.id };
}

// GET — 查询所有内测码
export async function GET(req: Request) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.msg }, { status: auth.status });
  }

  const { searchParams } = new URL(req.url);
  const used = searchParams.get("used");

  let query = supabase
    .from("invite_codes")
    .select("id, code, note, used_by, used_at, created_at, created_by")
    .order("created_at", { ascending: false });

  if (used === "true") {
    query = query.not("used_by", "is", null);
  } else if (used === "false") {
    query = query.is("used_by", null);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: "查询失败" }, { status: 500 });
  }

  return NextResponse.json({ codes: data ?? [] });
}

// POST — 批量生成内测码
export async function POST(req: Request) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.msg }, { status: auth.status });
  }

  const { count, note } = await req.json();
  if (!count || typeof count !== "number" || count < 1 || count > 100) {
    return NextResponse.json({ error: "数量须为 1-100" }, { status: 400 });
  }

  const rows = Array.from({ length: count }, () => ({
    code: generateCode(),
    created_by: auth.userId,
    note: note || "",
  }));

  const { data, error } = await supabase
    .from("invite_codes")
    .insert(rows)
    .select("id, code, note, used_by, used_at, created_at");

  if (error) {
    return NextResponse.json({ error: "生成失败" }, { status: 500 });
  }

  return NextResponse.json({ codes: data ?? [] });
}

// DELETE — 删除未使用的内测码
export async function DELETE(req: Request) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.msg }, { status: auth.status });
  }

  const { id } = await req.json();
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  }

  const { error } = await supabase
    .from("invite_codes")
    .delete()
    .eq("id", id)
    .is("used_by", null); // 只能删未使用的

  if (error) {
    return NextResponse.json({ error: "删除失败（可能已被使用）" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
