import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * 邮件链接落地页（找回密码 / 邮箱确认 / 魔法链接）。
 *
 * 为什么不沿用 Supabase 默认链接：
 * 默认的 `{{ .ConfirmationURL }}` 指向 `https://<ref>.supabase.co/auth/v1/verify`，
 * 这一跳在中国大陆会被 SNI 定向阻断 —— 用户点邮件里的链接直接打不开，
 * 表现为「链接失效」。改成 `{{ .SiteURL }}/auth/confirm?token_hash=...` 后，
 * 浏览器只访问本站（Vercel sin1），再由服务端向 Supabase 换取会话。
 *
 * 邮箱模板需改为（Authentication → Emails → Reset Password）：
 *   <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=recovery&amp;next=/update-password">重置密码</a>
 *
 * 该路由必须在 middleware 的免鉴权白名单内：链接进来时用户还没有会话，
 * 被 updateSession 拦下就会直接跳登录页，token 白白作废。
 */

/** 只接受站内相对路径，避免 next 参数被用来做开放重定向 */
function safeNext(raw: string | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"));

  if (!tokenHash || !type) {
    return NextResponse.redirect(`${origin}/login?error=link_invalid`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  });

  if (error) {
    // 链接过期 / 已被使用 / 被邮件客户端预取 —— 都走这里，提示重新申请
    // 不把 Supabase 的英文原文塞进 URL：既难看，也会被日志/分享带出去
    return NextResponse.redirect(`${origin}/login?error=link_expired`);
  }

  // 找回密码：会话已写入 cookie，去设置新密码
  if (type === "recovery") {
    return NextResponse.redirect(`${origin}/update-password`);
  }

  // 邮箱确认：回登录页并带上邮箱，方便用户直接登录
  if (type === "signup" || type === "email" || type === "email_change") {
    const email = data.user?.email ?? "";
    return NextResponse.redirect(
      `${origin}/login?verified=1&email=${encodeURIComponent(email)}`
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}
