import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateDietLog, softDeleteDietLog, type DietLogRow, type MealType } from "@/lib/diet-log-service";

const VALID_MEALS: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

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

    if (body.meal_type != null && !VALID_MEALS.includes(body.meal_type as MealType)) {
      return NextResponse.json({ error: "餐次无效" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    // Ownership check
    const { data: existing, error: fetchErr } = await supabase
      .from("diet_logs")
      .select("user_id")
      .eq("id", id)
      .eq("is_deleted", false)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: "记录不存在" }, { status: 404 });
    }
    if (existing.user_id !== user.id) {
      return NextResponse.json({ error: "无权修改" }, { status: 403 });
    }

    const patch: Record<string, unknown> = {};
    if (body.meal_type != null) patch.meal_type = body.meal_type;
    if (body.note != null) patch.note = typeof body.note === "string" ? body.note : null;
    if (body.servings != null) patch.servings = Number(body.servings);
    if (body.quantity_g != null) patch.quantity_g = Number(body.quantity_g);

    const updated = await updateDietLog(id, patch, supabase);
    if (!updated) {
      return NextResponse.json({ error: "更新失败" }, { status: 500 });
    }

    return NextResponse.json({ success: true, dietLog: updated as DietLogRow });
  } catch (error) {
    console.error("[api/diet-logs/[id] PATCH] error:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}

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

    const { data: existing, error: fetchErr } = await supabase
      .from("diet_logs")
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

    const ok = await softDeleteDietLog(id, supabase);
    if (!ok) {
      return NextResponse.json({ error: "删除失败" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api/diet-logs/[id] DELETE] error:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
