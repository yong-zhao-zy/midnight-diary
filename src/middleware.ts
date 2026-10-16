import { updateSession } from "@/lib/supabase/middleware";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // 排除无需鉴权的静态资源：
    // - _next/static、_next/image：构建产物
    // - sw.js(Service Worker 脚本)、manifest.json(PWA 清单)、bgm.mp3 等 public/ 下文件
    //   —— 这些若被鉴权拦截，会导致未登录状态下 SW 无法注册/更新、PWA 无法安装
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp3|mp4|woff2?|ttf)$).*)",
  ],
};
