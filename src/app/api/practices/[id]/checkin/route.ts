import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toggleCheckin, type CheckinAction, type PracticeStats } from "@/lib/practice-service";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * POST /api/practices/[id]/checkin
 * Body: { date: "YYYY-MM-DD", action: "checkin" | "uncheckin" }
 *
 * Idempotent:
 *   - checkin on already-checked-in day → no-op, returns current stats
 *   - uncheckin on not-checked-in day → no-op, returns current stats
 *
 * Always returns { total_days, consecutive_days } for UI refresh.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const date = typeof body.date === "string" ? body.date : null;
    const action = typeof body.action === "string" ? body.action as CheckinAction : null;

    if (!date || !DATE_REGEX.test(date)) {
      return NextResponse.json({ error: "日期格式应为 YYYY-MM-DD" }, { status: 400 });
    }
    if (action !== "checkin" && action !== "uncheckin") {
      return NextResponse.json({ error: "无效的 action（仅支持 checkin / uncheckin）" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    // Ownership check
    const { data: existing, error: fetchErr } = await supabase
      .from("practices")
      .select("user_id, status")
      .eq("id", id)
      .eq("is_deleted", false)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: "练习不存在" }, { status: 404 });
    }
    if (existing.user_id !== user.id) {
      return NextResponse.json({ error: "无权操作他人练习" }, { status: 403 });
    }
    if (existing.status === "completed") {
      return NextResponse.json({ error: "练习已完结，无法打卡" }, { status: 400 });
    }

    const stats = await toggleCheckin(id, date, action, supabase);
    if (!stats) {
      return NextResponse.json({ error: "打卡操作失败" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      stats: stats as PracticeStats,
    });
  } catch (error) {
    console.error("[api/practices/[id]/checkin POST] error:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
