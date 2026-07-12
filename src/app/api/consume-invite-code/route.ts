import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const { code } = await req.json();
  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "缺少内测码" }, { status: 400 });
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  // 查码
  const { data: codeRow, error: findErr } = await supabase
    .from("invite_codes")
    .select("id, used_by")
    .eq("code", code.trim())
    .single();

  if (findErr || !codeRow) {
    return NextResponse.json({ error: "内测码不存在" }, { status: 404 });
  }
  if (codeRow.used_by) {
    return NextResponse.json({ error: "内测码已被使用" }, { status: 409 });
  }

  // 原子更新：标记已用（乐观锁 is('used_by', null)）
  const { error: upErr } = await supabase
    .from("invite_codes")
    .update({ used_by: user.id, used_at: new Date().toISOString() })
    .eq("id", codeRow.id)
    .is("used_by", null);

  if (upErr) {
    return NextResponse.json({ error: "使用失败，请重试" }, { status: 500 });
  }

  // 绑定到 profiles
  const { error: profileErr } = await supabase
    .from("profiles")
    .update({ invite_code_id: codeRow.id })
    .eq("id", user.id);

  if (profileErr) {
    return NextResponse.json({ error: "绑定失败，请联系管理员" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
