import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchFoods, fetchUserFoods, createFood, type FoodRow } from "@/lib/food-service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? "";
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10) || 20, 100);

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    if (q.trim()) {
      const foods = await searchFoods(user.id, q.trim(), limit, supabase);
      return NextResponse.json({ success: true, foods: foods as FoodRow[] });
    }
    // No query → return user's custom foods
    const foods = await fetchUserFoods(user.id, supabase);
    return NextResponse.json({ success: true, foods: foods as FoodRow[] });
  } catch (error) {
    console.error("[api/foods GET] error:", error);
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
      return NextResponse.json({ error: "食物名称不能为空" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const food = await createFood({
      userId: user.id,
      name,
      category: typeof body.category === "string" ? body.category : undefined,
      energy_kcal: Number(body.energy_kcal) || 0,
      protein_g: Number(body.protein_g) || 0,
      fat_g: Number(body.fat_g) || 0,
      carb_g: Number(body.carb_g) || 0,
      fiber_g: Number(body.fiber_g) || 0,
      default_serving_g: body.default_serving_g ? Number(body.default_serving_g) : undefined,
      default_serving_name: typeof body.default_serving_name === "string" ? body.default_serving_name : undefined,
    }, supabase);

    if (!food) {
      return NextResponse.json({ error: "保存失败" }, { status: 500 });
    }

    return NextResponse.json({ success: true, food: food as FoodRow });
  } catch (error) {
    console.error("[api/foods POST] error:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
