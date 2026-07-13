import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/account/delete
 * 注销当前登录用户账号 — 调用 RPC 事务删除全部数据
 *
 * 鉴权：从 session 提取 user.id，禁止传参指定他人
 * 流程：RPC delete_user_account（软标记 → 物理删除业务表 → 删 auth.users）→ 返回成功
 */
export async function POST() {
  // 1. 鉴权 — 使用 session-bound 客户端验证当前用户
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const userId = user.id;

  // 2. 调用 RPC — 使用 service role 客户端绕过 RLS
  try {
    const admin = createAdminClient();

    const { error: rpcError } = await admin.rpc("delete_user_account", {
      target_user_id: userId,
    });

    if (rpcError) {
      console.error("[account/delete] RPC error:", rpcError);
      return NextResponse.json(
        { error: "注销失败，请联系管理员" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "账号已注销",
    });
  } catch (err) {
    console.error("[account/delete] unexpected error:", err);
    return NextResponse.json(
      { error: "注销失败，请联系管理员" },
      { status: 500 }
    );
  }
}
