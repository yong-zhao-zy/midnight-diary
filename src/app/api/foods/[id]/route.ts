import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateFood, softDeleteFood, type FoodRow } from "@/lib/food-service";

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

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    // Ownership check: only user-sourced foods can be edited
    const { data: existing, error: fetchErr } = await supabase
      .from("foods")
      .select("user_id, source")
      .eq("id", id)
      .eq("is_deleted", false)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: "食物不存在" }, { status: 404 });
    }
    if (existing.source === "system") {
      return NextResponse.json({ error: "系统食物不可修改" }, { status: 403 });
    }
    if (existing.user_id !== user.id) {
      return NextResponse.json({ error: "无权修改" }, { status: 403 });
    }

    const patch: Record<string, unknown> = {};
    if (typeof body.name === "string") patch.name = body.name.trim();
    if (typeof body.category === "string") patch.category = body.category;
    for (const key of ["energy_kcal", "protein_g", "fat_g", "carb_g", "fiber_g", "default_serving_g"]) {
      if (body[key] != null) patch[key] = Number(body[key]);
    }
    if (typeof body.default_serving_name === "string") patch.default_serving_name = body.default_serving_name;

    const updated = await updateFood(id, patch, supabase);
    if (!updated) {
      return NextResponse.json({ error: "更新失败" }, { status: 500 });
    }

    return NextResponse.json({ success: true, food: updated as FoodRow });
  } catch (error) {
    console.error("[api/foods/[id] PATCH] error:", error);
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
      .from("foods")
      .select("user_id, source")
      .eq("id", id)
      .eq("is_deleted", false)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: "食物不存在" }, { status: 404 });
    }
    if (existing.source === "system") {
      return NextResponse.json({ error: "系统食物不可删除" }, { status: 403 });
    }
    if (existing.user_id !== user.id) {
      return NextResponse.json({ error: "无权删除" }, { status: 403 });
    }

    const ok = await softDeleteFood(id, supabase);
    if (!ok) {
      return NextResponse.json({ error: "删除失败" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api/foods/[id] DELETE] error:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
