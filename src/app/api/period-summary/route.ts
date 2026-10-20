import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensurePeriodSummaries, PERIOD_AI_MAX_LEN } from "@/lib/period-summary-server";
import { PERIOD_SCOPES, getPeriodLabel, type PeriodScope } from "@/lib/period-summary-service";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;
const MODULE_RE = /^[A-Za-z0-9_-]{1,32}$/;

interface RequestBody {
  scope?: string;
  periodKey?: string;
  modules?: { id?: string; label?: string }[];
  force?: boolean;
}

/**
 * POST /api/period-summary
 * Body: { scope: 'week'|'month', periodKey, modules: [{id,label}], force? }
 *
 * 取周期 AI 摘要：
 *   - 源数据指纹一致 → 直接返回缓存（不调 LLM）
 *   - 指纹变化 / force → 生成整周期所有模块的摘要并落库
 * 只写 period_summaries，用户手写的摘要（summary_overrides）不受影响。
 */
export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const scope = PERIOD_SCOPES.includes(body.scope as PeriodScope)
    ? (body.scope as PeriodScope)
    : null;
  const periodKey = (body.periodKey ?? "").trim();

  if (!scope) {
    return NextResponse.json({ error: "scope 无效（week/month）" }, { status: 400 });
  }
  if (scope === "month" ? !MONTH_RE.test(periodKey) : !DAY_RE.test(periodKey)) {
    return NextResponse.json({ error: "periodKey 格式无效" }, { status: 400 });
  }

  const modules = (body.modules ?? [])
    .filter(
      (m): m is { id: string; label: string } =>
        !!m && typeof m.id === "string" && MODULE_RE.test(m.id)
    )
    .map((m) => ({ id: m.id, label: typeof m.label === "string" && m.label ? m.label : m.id }));

  if (modules.length === 0) {
    return NextResponse.json({ error: "缺少 modules 参数" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const result = await ensurePeriodSummaries({
      supabase,
      userId: user.id,
      scope,
      periodKey,
      modules,
      force: body.force === true,
    });

    return NextResponse.json({
      success: true,
      scope,
      periodKey,
      periodLabel: getPeriodLabel(scope, periodKey),
      summaries: result.summaries,
      generated: result.generated,
      diaryCount: result.diaryCount,
      maxLen: PERIOD_AI_MAX_LEN[scope],
    });
  } catch (error) {
    console.error("Period summary route error:", error);
    return NextResponse.json({ error: "周期摘要生成失败，请重试" }, { status: 502 });
  }
}
