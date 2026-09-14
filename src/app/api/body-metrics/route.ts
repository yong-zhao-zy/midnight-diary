import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  fetchRecentBodyMetrics,
  fetchBodyMetricsByRange,
  upsertBodyMetric,
  type BodyMetricRow,
} from "@/lib/body-metric-service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit");
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    if (start && end) {
      const metrics = await fetchBodyMetricsByRange(user.id, start, end, supabase);
      return NextResponse.json({ success: true, bodyMetrics: metrics as BodyMetricRow[] });
    }

    const n = limit ? Math.min(parseInt(limit, 10) || 30, 365) : 30;
    const metrics = await fetchRecentBodyMetrics(user.id, n, supabase);
    return NextResponse.json({ success: true, bodyMetrics: metrics as BodyMetricRow[] });
  } catch (error) {
    console.error("[api/body-metrics GET] error:", error);
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

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const metric = await upsertBodyMetric({
      userId: user.id,
      log_date,
      weight_kg: body.weight_kg != null && body.weight_kg !== "" ? Number(body.weight_kg) : undefined,
      waist_cm: body.waist_cm != null && body.waist_cm !== "" ? Number(body.waist_cm) : undefined,
      hip_cm: body.hip_cm != null && body.hip_cm !== "" ? Number(body.hip_cm) : undefined,
      chest_cm: body.chest_cm != null && body.chest_cm !== "" ? Number(body.chest_cm) : undefined,
      left_arm_cm: body.left_arm_cm != null && body.left_arm_cm !== "" ? Number(body.left_arm_cm) : undefined,
      right_arm_cm: body.right_arm_cm != null && body.right_arm_cm !== "" ? Number(body.right_arm_cm) : undefined,
      left_thigh_cm: body.left_thigh_cm != null && body.left_thigh_cm !== "" ? Number(body.left_thigh_cm) : undefined,
      right_thigh_cm: body.right_thigh_cm != null && body.right_thigh_cm !== "" ? Number(body.right_thigh_cm) : undefined,
      body_fat_pct: body.body_fat_pct != null && body.body_fat_pct !== "" ? Number(body.body_fat_pct) : undefined,
      note: typeof body.note === "string" ? body.note : undefined,
    }, supabase);

    if (!metric) {
      return NextResponse.json({ error: "保存失败" }, { status: 500 });
    }

    return NextResponse.json({ success: true, bodyMetric: metric as BodyMetricRow });
  } catch (error) {
    console.error("[api/body-metrics POST] error:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
