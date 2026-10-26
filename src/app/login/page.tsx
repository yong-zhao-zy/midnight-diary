"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Mail, Lock, User, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toFriendlyError } from "@/lib/supabase/errors";

type Mode = "login" | "register" | "register-success" | "forgot" | "forgot-success";

export default function LoginPage() {
  return (
    <Suspense fallback={
      <main className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent/60" />
      </main>
    }>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const passwordRef = useRef<HTMLInputElement>(null);

  // Detect email-confirmed redirect
  useEffect(() => {
    const verified = searchParams.get("verified");
    const verifiedEmail = searchParams.get("email");
    const linkError = searchParams.get("error");

    // 邮件链接失效（过期 / 已被使用 / 被邮件客户端预取）—— 由 /auth/confirm 带回
    if (linkError) {
      setError(
        linkError === "link_invalid"
          ? "邮件链接不完整，请重新申请找回密码。"
          : "邮件链接已失效（可能已使用或已过期），请重新申请。"
      );
      return;
    }

    if (verified === "1") {
      setToast("邮箱验证成功！欢迎来到深空回响，请输入密码登录。");
      if (verifiedEmail) setEmail(decodeURIComponent(verifiedEmail));
      setMode("login");
      // Focus password field after render
      setTimeout(() => passwordRef.current?.focus(), 300);
    }
  }, [searchParams]);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 5000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // Validation
  const emailTouched = email.length > 0;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const emailShowError = emailTouched && !emailValid && email.length > 3;
  const passwordMismatch = mode === "register" && confirmPassword && password !== confirmPassword;

  const handleLogin = async () => {
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) throw signInError;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").upsert(
        {
          id: user.id,
          username: user.user_metadata?.username || email.split("@")[0],
        },
        { onConflict: "id" }
      );
    }

    router.push("/");
    router.refresh();
  };

  const handleRegister = async () => {
    if (!username.trim()) throw new Error("请输入昵称");
    if (!emailValid) throw new Error("请输入正确的邮箱地址");
    if (password.length < 6) throw new Error("密码至少 6 位");
    if (password !== confirmPassword) throw new Error("两次密码不一致");

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
        emailRedirectTo: `${window.location.origin}/auth/callback?type=email_confirmation`,
      },
    });

    if (signUpError) {
      if (signUpError.message.includes("rate")) {
        throw new Error("发送失败，请稍后再试");
      }
      throw new Error("发送失败，请输入正确的邮箱地址或稍后再试");
    }

    setMode("register-success");
  };

  const handleForgot = async () => {
    if (!emailValid) throw new Error("请输入正确的邮箱地址");

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
      }
    );

    if (resetError) throw new Error("发送失败，请检查邮箱地址或稍后再试");

    setMode("forgot-success");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "login") await handleLogin();
      else if (mode === "register") await handleRegister();
      else if (mode === "forgot") await handleForgot();
    } catch (err: unknown) {
      // 网络不可达（iOS Safari 报 "Load failed"）时给出明确提示，
      // 避免用户把网络问题误判为「密码错误」而反复重试。
      setError(toFriendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm space-y-8"
      >
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-semibold text-accent">深空回响</h1>
          <p className="text-ink-2 text-sm">
            {mode === "login" && "欢迎回来，夜行者"}
            {mode === "register" && "开始你的深夜旅程"}
            {mode === "forgot" && "找回你的密码"}
          </p>
        </div>

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-accent/10 border border-accent/20 text-sm text-accent"
            >
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span>{toast}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Success states ─── */}
        <AnimatePresence mode="wait">
          {mode === "register-success" && (
            <motion.div
              key="register-success"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-center space-y-5 py-8"
            >
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
                  <Mail className="h-7 w-7 text-accent" />
                </div>
              </div>
              <h2 className="text-xl font-semibold text-ink">验证邮件已发送</h2>
              <p className="text-sm text-ink-2 leading-relaxed">
                已向 <span className="text-accent/80">{email}</span> 发送确认邮件，
                <br />
                请前往邮箱点击确认按钮完成注册。
              </p>
              <p className="text-xs text-ink-2/60 leading-relaxed">
                若 1 分钟内未收到邮件，请检查【垃圾邮件】文件夹。
              </p>
              <button
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
                className="text-sm text-accent/80 hover:text-accent underline underline-offset-4 transition-colors"
              >
                返回登录
              </button>
            </motion.div>
          )}

          {mode === "forgot-success" && (
            <motion.div
              key="forgot-success"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-center space-y-5 py-8"
            >
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
                  <Mail className="h-7 w-7 text-accent" />
                </div>
              </div>
              <h2 className="text-xl font-semibold text-ink">重置邮件已发送</h2>
              <p className="text-sm text-ink-2 leading-relaxed">
                已向 <span className="text-accent/80">{email}</span> 发送密码重置链接，
                <br />
                请前往邮箱点击链接设置新密码。
              </p>
              <button
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
                className="text-sm text-accent/80 hover:text-accent underline underline-offset-4 transition-colors"
              >
                返回登录
              </button>
            </motion.div>
          )}

          {/* ─── Forms ─── */}
          {(mode === "login" || mode === "register" || mode === "forgot") && (
            <motion.form
              key={mode}
              initial={{ opacity: 0, x: mode === "register" ? 30 : mode === "forgot" ? 30 : -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              {/* Nickname (register only) */}
              {mode === "register" && (
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-2/70" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="昵称"
                    required
                    className="w-full h-12 pl-10 pr-4 rounded-xl bg-surface-3 border border-line-2 text-ink placeholder:text-ink-2/60 focus:outline-none focus:border-accent/50 transition-colors"
                  />
                </div>
              )}

              {/* Email */}
              <div className="space-y-1">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-2/70" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="邮箱"
                    required
                    className={`w-full h-12 pl-10 pr-4 rounded-xl bg-surface-3 border text-ink placeholder:text-ink-2/60 focus:outline-none transition-colors ${
                      emailShowError
                        ? "border-red-400/60 focus:border-red-400"
                        : "border-line-2 focus:border-accent/50"
                    }`}
                  />
                </div>
                {emailShowError && (
                  <p className="text-xs text-red-400/90 pl-1">请输入正确的邮箱格式</p>
                )}
              </div>

              {/* Password (login & register) */}
              {mode !== "forgot" && (
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-2/70" />
                  <input
                    ref={passwordRef}
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="密码"
                    required
                    minLength={6}
                    className="w-full h-12 pl-10 pr-4 rounded-xl bg-surface-3 border border-line-2 text-ink placeholder:text-ink-2/60 focus:outline-none focus:border-accent/50 transition-colors"
                  />
                </div>
              )}

              {/* Confirm Password (register only) */}
              {mode === "register" && (
                <div className="space-y-1">
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-2/70" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="确认密码"
                      required
                      minLength={6}
                      className={`w-full h-12 pl-10 pr-4 rounded-xl bg-surface-3 border text-ink placeholder:text-ink-2/60 focus:outline-none transition-colors ${
                        passwordMismatch
                          ? "border-red-400/60 focus:border-red-400"
                          : "border-line-2 focus:border-accent/50"
                      }`}
                    />
                  </div>
                  {passwordMismatch && (
                    <p className="text-xs text-red-400/90 pl-1">两次密码不一致</p>
                  )}
                </div>
              )}

              {/* Error */}
              {error && (
                <p className="text-sm text-red-400/90 text-center">{error}</p>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || (mode === "register" && !!passwordMismatch)}
                className="w-full h-12 rounded-xl bg-accent text-accent-ink font-semibold hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {mode === "login" && "进入深夜"}
                {mode === "register" && "注册"}
                {mode === "forgot" && "发送重置链接"}
              </button>

              {/* Forgot password (login only) */}
              {mode === "login" && (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("forgot");
                      setError("");
                    }}
                    className="text-xs text-ink-2/70 hover:text-ink-2 transition-colors"
                  >
                    忘记密码？
                  </button>
                </div>
              )}
            </motion.form>
          )}
        </AnimatePresence>

        {/* Toggle mode */}
        {(mode === "login" || mode === "register" || mode === "forgot") && (
          <p className="text-center text-sm text-ink-2">
            {mode === "login" && "还没有账号？"}
            {mode === "register" && "已有账号？"}
            {mode === "forgot" && "想起密码了？"}
            <button
              onClick={() => {
                setMode(mode === "register" ? "login" : mode === "forgot" ? "login" : "register");
                setError("");
                setConfirmPassword("");
              }}
              className="ml-1 text-accent/80 hover:text-accent underline underline-offset-4 transition-colors"
            >
              {mode === "login" ? "立即注册" : "去登录"}
            </button>
          </p>
        )}
      </motion.div>
    </main>
  );
}
