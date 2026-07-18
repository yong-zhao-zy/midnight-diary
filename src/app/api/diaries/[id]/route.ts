import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deepMergeContent } from "@/lib/diary-service";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * PATCH /api/diaries/[id]
 * Body (any combination):
 *   { diaryDate: "YYYY-MM-DD" }                              — move diary to a new date
 *   { content: Record<string, string>, labelsSnapshot? }    — auto/manual content update
 *   { diaryDate, content, labelsSnapshot }                   — combined update
 *
 * - Auth required, ownership check.
 * - diary_date uniqueness enforced (excludes self) when diaryDate present.
 * - Content update does deep merge (existing + incoming) — never overwrites other modules.
 * - NEVER touches chat_history (protects AI 回响).
 * - Composes new created_at = newDate + original HH:MM:SS (local) when diaryDate present.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const diaryDate = typeof body.diaryDate === "string" ? body.diaryDate : undefined;
    const hasContent =
      body.content && typeof body.content === "object" && !Array.isArray(body.content);
    const hasLabelsSnapshot =
      body.labelsSnapshot && typeof body.labelsSnapshot === "object" && !Array.isArray(body.labelsSnapshot);

    // Validate diaryDate format if present
    if (diaryDate !== undefined && !DATE_REGEX.test(diaryDate)) {
      return NextResponse.json(
        { error: "Invalid diaryDate (expected YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    // At least one of diaryDate / content must be present
    if (diaryDate === undefined && !hasContent) {
      return NextResponse.json(
        { error: "Nothing to update (expected diaryDate or content)" },
        { status: 400 }
      );
    }

    // Future date lock — never allow dates beyond today (local)
    if (diaryDate !== undefined) {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      if (diaryDate > todayStr) {
        return NextResponse.json(
          { error: "不能选择未来的日期" },
          { status: 400 }
        );
      }
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch original diary for ownership + content merge + time preservation
    const { data: original, error: fetchError } = await supabase
      .from("diaries")
      .select("created_at, diary_date, user_id, content")
      .eq("id", id)
      .eq("is_deleted", false)
      .single();

    if (fetchError || !original) {
      return NextResponse.json({ error: "日记不存在" }, { status: 404 });
    }
    if (original.user_id !== user.id) {
      return NextResponse.json({ error: "无权修改他人日记" }, { status: 403 });
    }

    const updatePayload: Record<string, unknown> = {};

    // Content update — deep merge, protect chat_history
    if (hasContent) {
      const incomingContent = body.content as Record<string, string>;
      const existingContent = (original.content as Record<string, string>) || {};
      updatePayload.content = deepMergeContent(existingContent, incomingContent);

      if (hasLabelsSnapshot) {
        updatePayload.module_labels_snapshot = body.labelsSnapshot;
      }
    }

    // Date move — preserve original time-of-day
    if (diaryDate !== undefined) {
      // No-op if same date
      if (original.diary_date === diaryDate && !hasContent) {
        return NextResponse.json({ success: true, diary: original, noop: true });
      }

      // diary_date uniqueness check (exclude self) — 一日一记
      if (original.diary_date !== diaryDate) {
        const { data: conflict } = await supabase
          .from("diaries")
          .select("id")
          .eq("user_id", user.id)
          .eq("is_deleted", false)
          .eq("diary_date", diaryDate)
          .neq("id", id)
          .limit(1);

        if (conflict && conflict.length > 0) {
          return NextResponse.json(
            { error: "该日期已有日记，无法移动" },
            { status: 409 }
          );
        }
      }

      // Compose new created_at: new date + original local time (HH:MM:SS)
      const oldDate = new Date(original.created_at);
      const [y, m, d] = diaryDate.split("-").map(Number);
      const newDateObj = new Date(
        y,
        m - 1,
        d,
        oldDate.getHours(),
        oldDate.getMinutes(),
        oldDate.getSeconds(),
        oldDate.getMilliseconds()
      );
      updatePayload.created_at = newDateObj.toISOString();
      updatePayload.diary_date = diaryDate;
    }

    const { data: updated, error: updateError } = await supabase
      .from("diaries")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (updateError || !updated) {
      console.error("Update diary error:", updateError);
      return NextResponse.json({ error: "更新失败" }, { status: 500 });
    }

    return NextResponse.json({ success: true, diary: updated });
  } catch (error) {
    console.error("PATCH diary error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
