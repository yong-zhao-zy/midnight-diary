import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_STORAGE_KEY, SUPABASE_URL } from "./config";

/**
 * 邀请码/角色校验结果的内存缓存（按 userId）。
 * 中间件在每个导航（含 RSC 预取）都会跑，之前每次都查一次 profiles 表：
 * 一次跨境往返 ≈ 300~800ms，直接叠在 TTFB 上。缓存 5 分钟后
 * 同一个 Vercel 实例上的后续导航不再查库。
 */
const ACCESS_TTL_MS = 5 * 60 * 1000;
/** 未通过（还没兑换邀请码）的负结果只缓存 30 秒，兑换后能尽快放行 */
const ACCESS_DENY_TTL_MS = 30 * 1000;
const accessCache = new Map<string, { ok: boolean; at: number; ttl: number }>();

function readAccessCache(userId: string): boolean | null {
  const hit = accessCache.get(userId);
  if (!hit) return null;
  if (Date.now() - hit.at > hit.ttl) {
    accessCache.delete(userId);
    return null;
  }
  return hit.ok;
}

function writeAccessCache(userId: string, ok: boolean) {
  accessCache.set(userId, { ok, at: Date.now(), ttl: ok ? ACCESS_TTL_MS : ACCESS_DENY_TTL_MS });
  // 简单的容量保护：个人应用量级很小，超过 200 条就整体清空
  if (accessCache.size > 200) accessCache.clear();
}

export async function updateSession(request: NextRequest) {
  // Public routes that don't require authentication — check BEFORE getUser()
  // to avoid a network round-trip for API/login/share routes.
  // `/auth` 覆盖 /auth/callback 与 /auth/confirm：邮件链接进来时还没会话，
  // 被这里拦下会直接跳登录页、token 作废。
  const publicPaths = ["/login", "/api", "/auth", "/update-password", "/share", "/invite-required"];
  const isPublic = publicPaths.some((p) => request.nextUrl.pathname.startsWith(p));

  if (isPublic) {
    return NextResponse.next({ request });
  }

  const redirectTo = (pathname: string) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    return NextResponse.redirect(url);
  };

  // 快速通道：连会话 cookie 都没有（未登录页、清缓存后首次访问），
  // 不必建 client、更不必走网络——直接回登录页。省掉两次跨境往返。
  const hasAuthCookie = request.cookies
    .getAll()
    .some((c) => c.name === SUPABASE_STORAGE_KEY || c.name.startsWith(`${SUPABASE_STORAGE_KEY}.`));
  if (!hasAuthCookie) {
    return redirectTo("/login");
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      // 与浏览器端保持同一会话键名
      cookieOptions: { name: SUPABASE_STORAGE_KEY },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getClaims() 用 JWKS 本地验签（本项目是 ES256），不发 /auth/v1/user 请求；
  // 只有 JWT 是对称密钥签名时才回退到网络校验。TTFB 因此少一次往返。
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub as string | undefined;

  if (claimsError || !userId) {
    return redirectTo("/login");
  }

  // Invite code gate — check profiles.role + invite_code_id（结果缓存 5 分钟）
  // Admin bypasses; users with a consumed invite code pass; others redirected.
  let allowed = readAccessCache(userId);
  if (allowed === null) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, invite_code_id")
      .eq("id", userId)
      .eq("is_deleted", false)
      .single();

    allowed = profile?.role === "admin" || !!profile?.invite_code_id;
    writeAccessCache(userId, allowed);
  }

  if (!allowed) {
    return redirectTo("/invite-required");
  }

  return supabaseResponse;
}
