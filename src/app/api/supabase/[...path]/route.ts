import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_URL } from "@/lib/supabase/config";

/**
 * Supabase 同域代理。
 *
 * 浏览器发往 `/api/supabase/<...>` 的请求在这里被转发到真实的
 * `https://<project>.supabase.co/<...>`。目的是让浏览器全程只与站点自身域名
 * 通信，绕开中国大陆对 `*.supabase.co` 的 SNI 定向阻断。
 *
 * 等价性：这里不解析、不改写任何业务数据，只做逐字节转发，鉴权与 RLS 仍由
 * Supabase 自己判定 —— 拿不到合法 anon key / 用户 token 依然查不到数据。
 *
 * 注意：`/api` 前缀已在 middleware 的免鉴权白名单内，因此本路由不会被
 * updateSession 拦截（拦截会导致登录请求本身无法发出）。
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

/** 逐跳头部：只对单条连接有意义，不能跨代理转发 */
const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

/** 转发请求时应丢弃的头部 */
const DROP_REQUEST = new Set([
  ...HOP_BY_HOP,
  "host", // 必须换成目标域名
  "content-length", // 由 fetch 按实际 body 重算
  "accept-encoding", // 让上游返回未压缩内容，避免向浏览器透传错误编码
  "cookie", // 本站会话 cookie 与 Supabase 无关，避免外泄
]);

/** 回传响应时应丢弃的头部 */
const DROP_RESPONSE = new Set([
  ...HOP_BY_HOP,
  "content-encoding", // 已被 fetch 解压
  "content-length", // body 长度可能变化
  "set-cookie", // 单独处理后追加（需要剥离 Domain）
]);

/**
 * Supabase 的 Set-Cookie 可能带 `Domain=.xxx.supabase.co`。
 * 浏览器会因域不匹配而直接丢弃，必须剥掉 Domain 才能在站点域名下生效。
 */
function sanitizeSetCookie(value: string): string {
  return value
    .split(";")
    .filter((part) => {
      const key = part.trim().toLowerCase();
      return !key.startsWith("domain=");
    })
    .join(";");
}

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  if (!SUPABASE_URL) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_SUPABASE_URL is not configured" },
      { status: 500 }
    );
  }

  const { path } = await context.params;
  const target = `${SUPABASE_URL}/${path.join("/")}${request.nextUrl.search}`;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!DROP_REQUEST.has(key.toLowerCase())) headers.set(key, value);
  });

  const method = request.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";
  // 日记类数据都是 KB 级 JSON，整块读取比流转发更稳，也便于统一超时控制
  const body = hasBody ? await request.arrayBuffer() : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method,
      headers,
      body: body && body.byteLength > 0 ? body : undefined,
      redirect: "manual", // 保留上游 3xx 的 Location 原样交给浏览器
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: "supabase_upstream_unreachable",
        message,
        // 让前端 toFriendlyError 能识别成网络错误而不是"密码错误"
        code: "NETWORK_ERROR",
      },
      { status: 502 }
    );
  }

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!DROP_RESPONSE.has(key.toLowerCase())) responseHeaders.set(key, value);
  });

  // Node 20+ / Next 16 支持 getSetCookie()；逐个剥离 Domain 后追加
  const setCookies = upstream.headers.getSetCookie?.() ?? [];
  for (const cookie of setCookies) {
    responseHeaders.append("set-cookie", sanitizeSetCookie(cookie));
  }

  // 鉴权响应一律不缓存
  responseHeaders.set("cache-control", "no-store");

  const payload = upstream.status === 204 || upstream.status === 304
    ? null
    : await upstream.arrayBuffer();

  return new NextResponse(payload, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const HEAD = proxy;
export const OPTIONS = proxy;
