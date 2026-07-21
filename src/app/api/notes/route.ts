import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchNotes, createNote, type NoteSourceType, type NoteRow } from "@/lib/note-service";

/**
 * GET /api/notes
 * Returns all notes for the authenticated user, newest first.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const notes = await fetchNotes(user.id);
    return NextResponse.json({ success: true, notes });
  } catch (error) {
    console.error("[api/notes GET] error:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}

/**
 * POST /api/notes
 * Body: { content: string, source_type: NoteSourceType, source_diary_id?: string }
 *
 * If source_diary_id is provided:
 *   - source_type must be 'ai_interpretation'
 *   - service layer verifies ownership + denormalizes diary_date into source_diary_date
 * If source_diary_id is absent:
 *   - source_type must be 'manual'
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const content = typeof body.content === "string" ? body.content.trim() : "";
    const sourceType = typeof body.source_type === "string" ? body.source_type as NoteSourceType : null;
    const sourceDiaryId = typeof body.source_diary_id === "string" && body.source_diary_id ? body.source_diary_id : undefined;

    if (!content) {
      return NextResponse.json({ error: "内容不能为空" }, { status: 400 });
    }
    if (sourceType !== "ai_interpretation" && sourceType !== "manual") {
      return NextResponse.json({ error: "无效的来源类型" }, { status: 400 });
    }
    // Consistency: ai_interpretation should carry source_diary_id; manual should not
    if (sourceType === "manual" && sourceDiaryId) {
      return NextResponse.json({ error: "手动添加的笔记不能关联日记" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const note = await createNote({
      userId: user.id,
      content,
      source_type: sourceType,
      source_diary_id: sourceDiaryId,
    });

    if (!note) {
      return NextResponse.json({ error: "保存失败" }, { status: 500 });
    }

    return NextResponse.json({ success: true, note: note as NoteRow });
  } catch (error) {
    console.error("[api/notes POST] error:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
