import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRecipeWithIngredients, updateRecipe, softDeleteRecipe } from "@/lib/recipe-service";

export async function GET(
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

    const recipe = await getRecipeWithIngredients(id, user.id, supabase);
    if (!recipe) {
      return NextResponse.json({ error: "菜谱不存在" }, { status: 404 });
    }

    return NextResponse.json({ success: true, recipe });
  } catch (error) {
    console.error("[api/recipes/[id] GET] error:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}

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

    // Ownership check
    const { data: existing, error: fetchErr } = await supabase
      .from("recipes")
      .select("user_id")
      .eq("id", id)
      .eq("is_deleted", false)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: "菜谱不存在" }, { status: 404 });
    }
    if (existing.user_id !== user.id) {
      return NextResponse.json({ error: "无权修改" }, { status: 403 });
    }

    const input: Record<string, unknown> = {};
    if (typeof body.name === "string") input.name = body.name.trim();
    if (typeof body.description === "string") input.description = body.description;
    if (body.servings != null) input.servings = Number(body.servings);
    if (typeof body.instructions === "string") input.instructions = body.instructions;
    if (Array.isArray(body.ingredients)) {
      input.ingredients = body.ingredients.map((ing: Record<string, unknown>) => ({
        food_id: String(ing.food_id),
        quantity_g: Number(ing.quantity_g),
        note: typeof ing.note === "string" ? ing.note : undefined,
      }));
    }

    const updated = await updateRecipe(id, input, supabase);
    if (!updated) {
      return NextResponse.json({ error: "更新失败" }, { status: 500 });
    }

    return NextResponse.json({ success: true, recipe: updated });
  } catch (error) {
    console.error("[api/recipes/[id] PATCH] error:", error);
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
      .from("recipes")
      .select("user_id")
      .eq("id", id)
      .eq("is_deleted", false)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: "菜谱不存在" }, { status: 404 });
    }
    if (existing.user_id !== user.id) {
      return NextResponse.json({ error: "无权删除" }, { status: 403 });
    }

    const ok = await softDeleteRecipe(id, supabase);
    if (!ok) {
      return NextResponse.json({ error: "删除失败" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api/recipes/[id] DELETE] error:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
