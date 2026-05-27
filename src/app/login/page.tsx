"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Mail, Lock, User, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "register" | "register-success" | "forgot" | "forgot-success";

export default function LoginPage() {
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
      const message = err instanceof Error ? err.message : "操作失败，请稍后重试";
      setError(message);
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
          <h1 className="text-3xl font-semibold text-glow-gold">深空回响</h1>
          <p className="text-muted text-sm">
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
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-glow-gold/10 border border-glow-gold/20 text-sm text-glow-gold"
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
                <div className="w-16 h-16 rounded-full bg-glow-gold/10 flex items-center justify-center">
                  <Mail className="h-7 w-7 text-glow-gold" />
                </div>
              </div>
              <h2 className="text-xl font-semibold text-foreground">验证邮件已发送</h2>
              <p className="text-sm text-muted leading-relaxed">
                已向 <span className="text-glow-gold/80">{email}</span> 发送确认邮件，
                <br />
                请前往邮箱点击确认按钮完成注册。
              </p>
              <p className="text-xs text-muted/50 leading-relaxed">
                若 1 分钟内未收到邮件，请检查【垃圾邮件】文件夹。
              </p>
              <button
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
                className="text-sm text-glow-gold/80 hover:text-glow-gold underline underline-offset-4 transition-colors"
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
                <div className="w-16 h-16 rounded-full bg-glow-gold/10 flex items-center justify-center">
                  <Mail className="h-7 w-7 text-glow-gold" />
                </div>
              </div>
              <h2 className="text-xl font-semibold text-foreground">重置邮件已发送</h2>
              <p className="text-sm text-muted leading-relaxed">
                已向 <span className="text-glow-gold/80">{email}</span> 发送密码重置链接，
                <br />
                请前往邮箱点击链接设置新密码。
              </p>
              <button
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
                className="text-sm text-glow-gold/80 hover:text-glow-gold underline underline-offset-4 transition-colors"
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
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted/60" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="昵称"
                    required
                    className="w-full h-12 pl-10 pr-4 rounded-xl bg-white/5 border border-white/10 text-foreground placeholder:text-muted/50 focus:outline-none focus:border-glow-gold/50 transition-colors"
                  />
                </div>
              )}

              {/* Email */}
              <div className="space-y-1">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted/60" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="邮箱"
                    required
                    className={`w-full h-12 pl-10 pr-4 rounded-xl bg-white/5 border text-foreground placeholder:text-muted/50 focus:outline-none transition-colors ${
                      emailShowError
                        ? "border-red-400/60 focus:border-red-400"
                        : "border-white/10 focus:border-glow-gold/50"
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
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted/60" />
                  <input
                    ref={passwordRef}
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="密码"
                    required
                    minLength={6}
                    className="w-full h-12 pl-10 pr-4 rounded-xl bg-white/5 border border-white/10 text-foreground placeholder:text-muted/50 focus:outline-none focus:border-glow-gold/50 transition-colors"
                  />
                </div>
              )}

              {/* Confirm Password (register only) */}
              {mode === "register" && (
                <div className="space-y-1">
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted/60" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="确认密码"
                      required
                      minLength={6}
                      className={`w-full h-12 pl-10 pr-4 rounded-xl bg-white/5 border text-foreground placeholder:text-muted/50 focus:outline-none transition-colors ${
                        passwordMismatch
                          ? "border-red-400/60 focus:border-red-400"
                          : "border-white/10 focus:border-glow-gold/50"
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
                className="w-full h-12 rounded-xl bg-glow-gold text-midnight font-semibold hover:bg-glow-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
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
                    className="text-xs text-muted/60 hover:text-muted transition-colors"
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
          <p className="text-center text-sm text-muted">
            {mode === "login" && "还没有账号？"}
            {mode === "register" && "已有账号？"}
            {mode === "forgot" && "想起密码了？"}
            <button
              onClick={() => {
                setMode(mode === "register" ? "login" : mode === "forgot" ? "login" : "register");
                setError("");
                setConfirmPassword("");
              }}
              className="ml-1 text-glow-gold/80 hover:text-glow-gold underline underline-offset-4 transition-colors"
            >
              {mode === "login" ? "立即注册" : "去登录"}
            </button>
          </p>
        )}
      </motion.div>
    </main>
  );
}
