import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  fetchPracticesByStatus,
  createPractice,
  type PracticeStatus,
  type PracticeSourceType,
  type PracticeRow,
} from "@/lib/practice-service";

/**
 * GET /api/practices?status=active|completed
 * Returns practices filtered by status for the authenticated user.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status") as PracticeStatus | null;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    // If no status specified, return both active + completed in one response
    if (!statusParam) {
      const [active, completed] = await Promise.all([
        fetchPracticesByStatus(user.id, "active"),
        fetchPracticesByStatus(user.id, "completed"),
      ]);
      return NextResponse.json({ success: true, active, completed });
    }

    if (statusParam !== "active" && statusParam !== "completed") {
      return NextResponse.json({ error: "无效的 status 参数" }, { status: 400 });
    }

    const practices = await fetchPracticesByStatus(user.id, statusParam);
    return NextResponse.json({ success: true, practices: practices as PracticeRow[] });
  } catch (error) {
    console.error("[api/practices GET] error:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}

/**
 * POST /api/practices
 * Body: { title: string, source_type: PracticeSourceType, source_diary_id?: string }
 *
 * If source_diary_id is provided:
 *   - source_type must be 'ai_interpretation'
 *   - service verifies ownership + denormalizes diary_date
 * If source_diary_id is absent:
 *   - source_type must be 'manual'
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const title = typeof body.title === "string" ? body.title.trim() : "";
    const sourceType = typeof body.source_type === "string" ? body.source_type as PracticeSourceType : null;
    const sourceDiaryId = typeof body.source_diary_id === "string" && body.source_diary_id ? body.source_diary_id : undefined;

    if (!title) {
      return NextResponse.json({ error: "练习名称不能为空" }, { status: 400 });
    }
    if (title.length > 100) {
      return NextResponse.json({ error: "练习名称过长（最多 100 字）" }, { status: 400 });
    }
    if (sourceType !== "ai_interpretation" && sourceType !== "manual") {
      return NextResponse.json({ error: "无效的来源类型" }, { status: 400 });
    }
    if (sourceType === "manual" && sourceDiaryId) {
      return NextResponse.json({ error: "手动添加的练习不能关联日记" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const practice = await createPractice({
      userId: user.id,
      title,
      source_type: sourceType,
      source_diary_id: sourceDiaryId,
    });

    if (!practice) {
      return NextResponse.json({ error: "保存失败" }, { status: 500 });
    }

    return NextResponse.json({ success: true, practice: practice as PracticeRow });
  } catch (error) {
    console.error("[api/practices POST] error:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
