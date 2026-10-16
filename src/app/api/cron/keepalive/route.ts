import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// 保活端点：由 Vercel Cron 每天调用一次，向 Supabase 发一条真实数据库查询。
// 目的：Supabase 免费计划连续 7 天无数据库活动会被自动暂停，本项目 2026-10 已踩过一次坑。
// 与 .github/workflows/supabase-keepalive.yml 形成双保险：任一存活即可保活。
//
// Vercel 部署在境外，可直连 *.supabase.co（国内网络会被 SNI 阻断，故不能在本机/国内链路验证）。

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  // 可选鉴权：若在 Vercel 环境变量里配置了 CRON_SECRET，
  // Vercel Cron 会自动带上 `Authorization: Bearer <CRON_SECRET>`，此时只放行带正确密钥的请求。
  // 未配置时跳过校验（端点仅做只读查询，无副作用）。
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401 }
      );
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return NextResponse.json(
      { ok: false, error: "missing NEXT_PUBLIC_SUPABASE_URL / ANON_KEY" },
      { status: 500 }
    );
  }

  const startedAt = Date.now();

  try {
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error } = await supabase.from("profiles").select("id").limit(1);

    if (error) {
      // 540 = project paused；52x = Cloudflare 源站不可达
      return NextResponse.json(
        {
          ok: false,
          supabase: "error",
          message: error.message,
          latencyMs: Date.now() - startedAt,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      ok: true,
      supabase: "up",
      latencyMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        supabase: "unreachable",
        message: err instanceof Error ? err.message : String(err),
        latencyMs: Date.now() - startedAt,
      },
      { status: 503 }
    );
  }
}
