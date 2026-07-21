import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateNoteContent, softDeleteNote, type NoteRow } from "@/lib/note-service";

/**
 * PATCH /api/notes/[id]
 * Body: { content: string }
 * Overwrites note content (Q3 confirmed — no merge, direct overwrite).
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

    const content = typeof body.content === "string" ? body.content.trim() : "";
    if (!content) {
      return NextResponse.json({ error: "内容不能为空" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    // Ownership check: fetch first, then update
    const { data: existing, error: fetchErr } = await supabase
      .from("notes")
      .select("user_id")
      .eq("id", id)
      .eq("is_deleted", false)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: "笔记不存在" }, { status: 404 });
    }
    if (existing.user_id !== user.id) {
      return NextResponse.json({ error: "无权修改他人笔记" }, { status: 403 });
    }

    const updated = await updateNoteContent(id, content);
    if (!updated) {
      return NextResponse.json({ error: "更新失败" }, { status: 500 });
    }

    return NextResponse.json({ success: true, note: updated as NoteRow });
  } catch (error) {
    console.error("[api/notes/[id] PATCH] error:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}

/**
 * DELETE /api/notes/[id]
 * Soft-deletes the note (is_deleted = true, deleted_at = now()).
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
      .from("notes")
      .select("user_id")
      .eq("id", id)
      .eq("is_deleted", false)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: "笔记不存在" }, { status: 404 });
    }
    if (existing.user_id !== user.id) {
      return NextResponse.json({ error: "无权删除他人笔记" }, { status: 403 });
    }

    const ok = await softDeleteNote(id);
    if (!ok) {
      return NextResponse.json({ error: "删除失败" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api/notes/[id] DELETE] error:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
