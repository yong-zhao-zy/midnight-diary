import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  fetchDietLogsByDate,
  fetchDietLogsByRange,
  createDietLog,
  type DietLogWithNames,
  type DietLogRow,
  type MealType,
} from "@/lib/diet-log-service";

const VALID_MEALS: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    if (date) {
      const logs = await fetchDietLogsByDate(user.id, date, supabase);
      return NextResponse.json({ success: true, dietLogs: logs as DietLogWithNames[] });
    }

    if (start && end) {
      const logs = await fetchDietLogsByRange(user.id, start, end, supabase);
      return NextResponse.json({ success: true, dietLogs: logs as DietLogRow[] });
    }

    return NextResponse.json({ error: "需要 date 或 start/end 参数" }, { status: 400 });
  } catch (error) {
    console.error("[api/diet-logs GET] error:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const log_date = typeof body.log_date === "string" ? body.log_date.trim() : "";
    if (!log_date) {
      return NextResponse.json({ error: "日期不能为空" }, { status: 400 });
    }

    const meal_type = typeof body.meal_type === "string" ? body.meal_type : "";
    if (!VALID_MEALS.includes(meal_type as MealType)) {
      return NextResponse.json({ error: "餐次无效" }, { status: 400 });
    }

    const food_id = body.food_id ? String(body.food_id) : undefined;
    const recipe_id = body.recipe_id ? String(body.recipe_id) : undefined;
    if (!food_id && !recipe_id) {
      return NextResponse.json({ error: "需要选择食物或菜谱" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const dietLog = await createDietLog({
      userId: user.id,
      log_date,
      meal_type: meal_type as MealType,
      food_id,
      recipe_id,
      servings: body.servings != null ? Number(body.servings) : undefined,
      quantity_g: body.quantity_g != null ? Number(body.quantity_g) : undefined,
      note: typeof body.note === "string" ? body.note : undefined,
    }, supabase);

    if (!dietLog) {
      return NextResponse.json({ error: "保存失败" }, { status: 500 });
    }

    return NextResponse.json({ success: true, dietLog: dietLog as DietLogRow });
  } catch (error) {
    console.error("[api/diet-logs POST] error:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
