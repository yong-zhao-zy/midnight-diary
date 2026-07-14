import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const { code } = await req.json();
  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "缺少内测码" }, { status: 400 });
  }

  const normalized = code.trim().toUpperCase();

  // session 客户端 — 用于鉴权
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  // service role 客户端 — 绕过 RLS
  const admin = createAdminClient();

  // ── 幂等检查 1：用户 profile 是否已绑定有效内测码 ──
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id, invite_code_id")
    .eq("id", user.id)
    .eq("is_deleted", false)
    .single();

  if (existingProfile?.invite_code_id) {
    // 已有绑定码，查一下码是否仍有效（未被删除）
    const { data: boundCode } = await admin
      .from("invite_codes")
      .select("code")
      .eq("id", existingProfile.invite_code_id)
      .eq("is_deleted", false)
      .single();

    if (boundCode) {
      // 已绑定有效码 — 直接返回成功（幂等）
      return NextResponse.json({ success: true, already_bound: true });
    }
    // 绑定的码已不存在（被管理员删除）— 允许重新消费新码
  }

  // ── 幂等检查 2：用户是否已占用其他码（防止重复消费）──
  const { data: usedCode } = await admin
    .from("invite_codes")
    .select("id, code")
    .eq("used_by", user.id)
    .eq("is_deleted", false)
    .single();

  if (usedCode) {
    // 已有占用的码 — 自动补绑 profile（修复历史遗漏）并返回成功
    await admin
      .from("profiles")
      .update({ invite_code_id: usedCode.id })
      .eq("id", user.id)
      .is("invite_code_id", null);

    return NextResponse.json({ success: true, already_bound: true });
  }

  // ── 查码 ──
  const { data: codeRow, error: findErr } = await admin
    .from("invite_codes")
    .select("id, used_by")
    .eq("code", normalized)
    .eq("is_deleted", false)
    .single();

  if (findErr || !codeRow) {
    return NextResponse.json({ error: "内测码不存在" }, { status: 404 });
  }
  if (codeRow.used_by) {
    return NextResponse.json({ error: "该内测码已被其他账号使用" }, { status: 409 });
  }

  // ── 原子更新：标记已用（乐观锁 is('used_by', null)）──
  const { error: upErr } = await admin
    .from("invite_codes")
    .update({ used_by: user.id, used_at: new Date().toISOString() })
    .eq("id", codeRow.id)
    .is("used_by", null);

  if (upErr) {
    return NextResponse.json({ error: "使用失败，请重试" }, { status: 500 });
  }

  // ── 绑定到 profiles（admin 客户端，确保 profile 存在时更新成功）──
  // 先尝试 update（profile 存在的情况）
  const { data: updateResult, error: profileErr } = await admin
    .from("profiles")
    .update({ invite_code_id: codeRow.id })
    .eq("id", user.id)
    .is("is_deleted", false)
    .select("id");

  if (profileErr) {
    // profile 更新失败 — 回滚内测码标记
    await admin
      .from("invite_codes")
      .update({ used_by: null, used_at: null })
      .eq("id", codeRow.id)
      .eq("used_by", user.id);

    return NextResponse.json(
      { error: "绑定失败，请联系管理员" },
      { status: 500 }
    );
  }

  // profile 不存在（update 影响 0 行）— upsert 创建
  if (!updateResult || updateResult.length === 0) {
    const { error: upsertErr } = await admin
      .from("profiles")
      .upsert(
        { id: user.id, invite_code_id: codeRow.id },
        { onConflict: "id" }
      );

    if (upsertErr) {
      // upsert 也失败 — 回滚内测码标记
      await admin
        .from("invite_codes")
        .update({ used_by: null, used_at: null })
        .eq("id", codeRow.id)
        .eq("used_by", user.id);

      return NextResponse.json(
        { error: "账号绑定失败，请联系管理员" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ success: true });
}
