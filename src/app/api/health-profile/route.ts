import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchHealthProfile, updateHealthProfile } from "@/lib/health-profile-service";
import type { HealthProfile } from "@/config/dri-config";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const profile = await fetchHealthProfile(supabase);
    return NextResponse.json({ success: true, healthProfile: profile });
  } catch (error) {
    console.error("[api/health-profile GET] error:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const profile: HealthProfile = {};
    if (body.height_cm != null) profile.height_cm = Number(body.height_cm) || undefined;
    if (typeof body.birth_date === "string" && body.birth_date.trim()) profile.birth_date = body.birth_date.trim();
    if (body.gender === "male" || body.gender === "female") profile.gender = body.gender;
    if (typeof body.activity_level === "string") profile.activity_level = body.activity_level as HealthProfile["activity_level"];
    if (body.calorie_goal != null) profile.calorie_goal = Number(body.calorie_goal) || undefined;
    if (body.target_weight_kg != null) profile.target_weight_kg = Number(body.target_weight_kg) || undefined;

    const ok = await updateHealthProfile(profile, supabase);
    if (!ok) {
      return NextResponse.json({ error: "保存失败" }, { status: 500 });
    }

    return NextResponse.json({ success: true, healthProfile: profile });
  } catch (error) {
    console.error("[api/health-profile PATCH] error:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
