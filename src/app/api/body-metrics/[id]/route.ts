import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteBodyMetric } from "@/lib/body-metric-service";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    // Ownership check
    const { data: existing, error: fetchErr } = await supabase
      .from("body_metrics")
      .select("user_id")
      .eq("id", id)
      .eq("is_deleted", false)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: "记录不存在" }, { status: 404 });
    }
    if (existing.user_id !== user.id) {
      return NextResponse.json({ error: "无权删除" }, { status: 403 });
    }

    const ok = await deleteBodyMetric(id, supabase);
    if (!ok) {
      return NextResponse.json({ error: "删除失败" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api/body-metrics/[id] DELETE] error:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
