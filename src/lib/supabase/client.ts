import { createBrowserClient } from "@supabase/ssr";
import {
  browserSupabaseUrl,
  SUPABASE_ANON_KEY,
  SUPABASE_STORAGE_KEY,
  SUPABASE_URL,
} from "./config";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

/**
 * 浏览器端一律走同域代理 `/api/supabase`，绝不直连 `*.supabase.co`
 * （国内网络下 TLS 握手会被 RST，表现为 `Load failed` / `Failed to fetch`）。
 * 服务端渲染阶段退回真实地址——服务端在境外，直连即可。
 */
export function createClient() {
  // SSR 阶段不缓存单例，避免跨请求污染（模块级变量在服务端是进程共享的）
  if (typeof window === "undefined") {
    return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookieOptions: { name: SUPABASE_STORAGE_KEY },
    });
  }

  if (browserClient) return browserClient;

  browserClient = createBrowserClient(browserSupabaseUrl(), SUPABASE_ANON_KEY, {
    // 显式钉死会话键名，确保 middleware / Server Component 能读到同一份会话
    cookieOptions: { name: SUPABASE_STORAGE_KEY },
  });
  return browserClient;
}
