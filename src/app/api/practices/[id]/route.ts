import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  updatePracticeTitle,
  completePractice,
  softDeletePractice,
  type PracticeRow,
} from "@/lib/practice-service";

/**
 * PATCH /api/practices/[id]
 * Body: { title?: string, status?: 'completed' }
 *   - title: overwrite practice title
 *   - status: only 'completed' accepted (auto-writes completed_at = now())
 *
 * Returns the updated practice row.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const hasTitle = typeof body.title === "string" && body.title.trim().length > 0;
    const title = hasTitle ? (body.title as string).trim() : null;
    const status = typeof body.status === "string" ? body.status : null;

    if (!hasTitle && status !== "completed") {
      return NextResponse.json(
        { error: "需要提供 title 或 status='completed'" },
        { status: 400 }
      );
    }
    if (status !== null && status !== "completed") {
      return NextResponse.json({ error: "无效的 status（仅支持 'completed'）" }, { status: 400 });
    }
    if (title && title.length > 100) {
      return NextResponse.json({ error: "练习名称过长（最多 100 字）" }, { status: 400 });
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
      return NextResponse.json({ error: "无权修改他人练习" }, { status: 403 });
    }

    let result: PracticeRow | null = null;

    if (status === "completed") {
      if (existing.status === "completed") {
        return NextResponse.json({ error: "练习已完结，无法重复操作" }, { status: 400 });
      }
      result = await completePractice(id, supabase);
    } else if (title) {
      result = await updatePracticeTitle(id, title, supabase);
    }

    if (!result) {
      return NextResponse.json({ error: "更新失败" }, { status: 500 });
    }

    return NextResponse.json({ success: true, practice: result });
  } catch (error) {
    console.error("[api/practices/[id] PATCH] error:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}

/**
 * DELETE /api/practices/[id]
 * Soft-deletes the practice + cascades soft-delete to practice_logs.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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
      .select("user_id")
      .eq("id", id)
      .eq("is_deleted", false)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: "练习不存在" }, { status: 404 });
    }
    if (existing.user_id !== user.id) {
      return NextResponse.json({ error: "无权删除他人练习" }, { status: 403 });
    }

    const ok = await softDeletePractice(id, supabase);
    if (!ok) {
      return NextResponse.json({ error: "删除失败" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api/practices/[id] DELETE] error:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
