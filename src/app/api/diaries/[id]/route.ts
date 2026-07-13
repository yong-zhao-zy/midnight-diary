import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * PATCH /api/diaries/[id]
 * Body: { diaryDate: "YYYY-MM-DD" }
 *
 * Updates a diary's belonging date while preserving the original time-of-day.
 * - Auth required, ownership check.
 * - diary_date uniqueness enforced (excludes self) — 一日一记约束.
 * - Composes new created_at = newDate + original HH:MM:SS (local).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const body = await request.json().catch(() => null);
    const diaryDate = body?.diaryDate;
    if (!diaryDate || typeof diaryDate !== "string" || !DATE_REGEX.test(diaryDate)) {
      return NextResponse.json(
        { error: "Invalid diaryDate (expected YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    // Future date lock — never allow dates beyond today (local)
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    if (diaryDate > todayStr) {
      return NextResponse.json(
        { error: "不能选择未来的日期" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch original diary for ownership + time preservation
    const { data: original, error: fetchError } = await supabase
      .from("diaries")
      .select("created_at, diary_date, user_id")
      .eq("id", id)
      .eq("is_deleted", false)
      .single();

    if (fetchError || !original) {
      return NextResponse.json({ error: "日记不存在" }, { status: 404 });
    }
    if (original.user_id !== user.id) {
      return NextResponse.json({ error: "无权修改他人日记" }, { status: 403 });
    }

    // No-op if same date
    if (original.diary_date === diaryDate) {
      return NextResponse.json({ success: true, diary: original, noop: true });
    }

    // diary_date uniqueness check (exclude self) — 一日一记
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
    const newCreatedAt = newDateObj.toISOString();

    const { data: updated, error: updateError } = await supabase
      .from("diaries")
      .update({ created_at: newCreatedAt, diary_date: diaryDate })
      .eq("id", id)
      .select()
      .single();

    if (updateError || !updated) {
      console.error("Update diary date error:", updateError);
      return NextResponse.json({ error: "日期更新失败" }, { status: 500 });
    }

    return NextResponse.json({ success: true, diary: updated });
  } catch (error) {
    console.error("PATCH diary error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
