import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const { code } = await req.json();
  if (!code || typeof code !== "string") {
    return NextResponse.json(
      { valid: false, error: "缺少内测码" },
      { status: 400 }
    );
  }

  const normalized = code.trim().toUpperCase();

  // 使用 service role 客户端绕过 RLS — 普通用户无法通过 RLS 查看未消费的码
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("invite_codes")
    .select("id, used_by")
    .eq("code", normalized)
    .eq("is_deleted", false)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { valid: false, error: "内测码不存在" },
      { status: 404 }
    );
  }

  if (data.used_by) {
    return NextResponse.json(
      { valid: false, error: "内测码已被使用" },
      { status: 409 }
    );
  }

  return NextResponse.json({ valid: true, inviteCodeId: data.id });
}
