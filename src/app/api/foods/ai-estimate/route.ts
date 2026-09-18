import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { estimateAndStoreFood } from "@/lib/ai-food-service";
import type { FoodRow } from "@/lib/food-service";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const query = typeof body.query === "string" ? body.query.trim() : "";
    if (!query) {
      return NextResponse.json({ error: "食物名称不能为空" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const food = await estimateAndStoreFood(query, user.id, supabase);
    if (!food) {
      return NextResponse.json({ error: "AI 估算失败，请换关键词重试" }, { status: 500 });
    }

    return NextResponse.json({ success: true, food: food as FoodRow });
  } catch (error) {
    console.error("[api/foods/ai-estimate POST] error:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
