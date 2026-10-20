import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  deleteOverride,
  fetchOverrides,
  overrideMaxLen,
  saveOverride,
  OVERRIDE_SCOPES,
  type OverrideScope,
} from "@/lib/summary-override-service";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;
const MODULE_RE = /^[A-Za-z0-9_-]{1,32}$/;

function parseScope(value: string | null): OverrideScope | null {
  return OVERRIDE_SCOPES.includes(value as OverrideScope) ? (value as OverrideScope) : null;
}

function isValidPeriodKey(scope: OverrideScope, key: string): boolean {
  if (scope === "month") return MONTH_RE.test(key);
  return DAY_RE.test(key);
}

/**
 * GET /api/summary-overrides?scope=day
 * 返回当前用户该 scope 下的全部摘要编辑（RLS 已按 user_id 过滤）。
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const scope = parseScope(searchParams.get("scope") ?? "day");
  if (!scope) {
    return NextResponse.json({ error: "scope 无效（day/week/month）" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const rows = await fetchOverrides(scope, supabase);
  return NextResponse.json({ success: true, overrides: rows });
}

/**
 * PUT /api/summary-overrides
 * Body: { scope, periodKey, moduleId, content }
 * - content 为空字符串 → 删除编辑，恢复 AI 摘要
 * - 长度上限 20 字（沿用 AI 摘要 5–20 字规则）
 */
export async function PUT(request: Request) {
  let body: {
    scope?: string;
    periodKey?: string;
    moduleId?: string;
    content?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const scope = parseScope(body.scope ?? null);
  const periodKey = (body.periodKey ?? "").trim();
  const moduleId = (body.moduleId ?? "").trim();
  const content = (body.content ?? "").trim();

  if (!scope) {
    return NextResponse.json({ error: "scope 无效（day/week/month）" }, { status: 400 });
  }
  if (!isValidPeriodKey(scope, periodKey)) {
    return NextResponse.json({ error: "periodKey 格式无效" }, { status: 400 });
  }
  if (!MODULE_RE.test(moduleId)) {
    return NextResponse.json({ error: "moduleId 无效" }, { status: 400 });
  }
  const maxLen = overrideMaxLen(scope);
  if (content.length > maxLen) {
    return NextResponse.json({ error: `摘要最长 ${maxLen} 字` }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  // 空内容 = 删除编辑，回落到 AI 摘要
  if (!content) {
    const ok = await deleteOverride({ scope, periodKey, moduleId }, supabase);
    return NextResponse.json({ success: ok, content: "" });
  }

  const ok = await saveOverride({ scope, periodKey, moduleId, content }, supabase);
  if (!ok) {
    return NextResponse.json({ error: "保存失败，请重试" }, { status: 500 });
  }
  return NextResponse.json({ success: true, content });
}

/**
 * DELETE /api/summary-overrides?scope=day&periodKey=YYYY-MM-DD&moduleId=m1
 * 删除编辑，恢复显示 AI 摘要。
 */
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const scope = parseScope(searchParams.get("scope"));
  const periodKey = (searchParams.get("periodKey") ?? "").trim();
  const moduleId = (searchParams.get("moduleId") ?? "").trim();

  if (!scope || !isValidPeriodKey(scope, periodKey) || !MODULE_RE.test(moduleId)) {
    return NextResponse.json({ error: "参数无效" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const ok = await deleteOverride({ scope, periodKey, moduleId }, supabase);
  if (!ok) {
    // 本来就没有编辑也算成功（已经是「显示 AI」状态）
    return NextResponse.json({ success: true, removed: false });
  }
  return NextResponse.json({ success: true, removed: true });
}
