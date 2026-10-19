/**
 * Supabase 连接配置（浏览器端 / 服务端共用）
 *
 * 背景：`*.supabase.co` 在中国大陆会被 SNI 定向阻断（TCP 能连，TLS 握手阶段被 RST）。
 * 浏览器直连的结果是 `Failed to fetch` / `Load failed`，表现为登录不上、
 * 已登录用户被渲染成空账号。
 *
 * 对策：浏览器端一律走同域代理 `/api/supabase/*`，由 Vercel 服务端（位于境外）
 * 转发到真实地址。浏览器全程只与站点自身域名通信，不再出现跨境直连。
 *
 * 服务端（Server Component / Route Handler / middleware / Cron）仍直连真实地址，
 * 因为 Vercel 在境外，不受阻断影响，直连比绕一层更快。
 */

/** 真实 Supabase 地址，仅服务端使用（去掉结尾斜杠，避免拼接出 `//`） */
export const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");

export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** 浏览器端使用的同域代理前缀 */
export const SUPABASE_PROXY_PATH = "/api/supabase";

/**
 * 会话存储键名，浏览器端与服务端必须完全一致。
 *
 * @supabase/ssr 的默认键名由 URL 主机名推导：`sb-<hostname 第一段>-auth-token`。
 * 浏览器改用代理地址后主机名变成本站域名，推导结果会和服务端的
 * `sb-<projectRef>-auth-token` 对不上 —— middleware 读不到会话，用户会被
 * 反复踢回登录页。所以这里显式钉死成真实 projectRef 推导出的键名：
 * 两端一致，且与改动前的键名相同，已登录用户不会掉线。
 */
export const SUPABASE_STORAGE_KEY = (() => {
  try {
    return `sb-${new URL(SUPABASE_URL).hostname.split(".")[0]}-auth-token`;
  } catch {
    return "sb-midnight-diary-auth-token";
  }
})();

/** 浏览器端应使用的 Supabase 基地址（同域绝对路径） */
export function browserSupabaseUrl(): string {
  if (typeof window === "undefined") return SUPABASE_URL;
  return `${window.location.origin}${SUPABASE_PROXY_PATH}`;
}
