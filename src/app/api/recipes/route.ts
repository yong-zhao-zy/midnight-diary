import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchRecipes, createRecipe, type RecipeRow } from "@/lib/recipe-service";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const recipes = await fetchRecipes(user.id, supabase);
    return NextResponse.json({ success: true, recipes: recipes as RecipeRow[] });
  } catch (error) {
    console.error("[api/recipes GET] error:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "菜谱名称不能为空" }, { status: 400 });
    }

    const servings = Number(body.servings) || 1;
    if (servings <= 0) {
      return NextResponse.json({ error: "份数必须大于0" }, { status: 400 });
    }

    const ingredients = Array.isArray(body.ingredients) ? body.ingredients : [];
    if (ingredients.length === 0) {
      return NextResponse.json({ error: "至少需要一种食材" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const recipe = await createRecipe({
      userId: user.id,
      name,
      description: typeof body.description === "string" ? body.description : undefined,
      servings,
      instructions: typeof body.instructions === "string" ? body.instructions : undefined,
      ingredients: ingredients.map((ing: Record<string, unknown>) => ({
        food_id: String(ing.food_id),
        quantity_g: Number(ing.quantity_g),
        note: typeof ing.note === "string" ? ing.note : undefined,
      })),
    }, supabase);

    if (!recipe) {
      return NextResponse.json({ error: "保存失败" }, { status: 500 });
    }

    return NextResponse.json({ success: true, recipe });
  } catch (error) {
    console.error("[api/recipes POST] error:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
