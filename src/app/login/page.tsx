"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, Mail, Lock, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "register";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "register") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username: username || email.split("@")[0] },
          },
        });

        if (signUpError) throw signUpError;

        // If session exists (email confirmation disabled), write profile immediately
        if (data.session && data.user) {
          await supabase.from("profiles").upsert({
            id: data.user.id,
            username: username || email.split("@")[0],
          });
        }

        // If no session (email confirmation enabled), profile will be
        // created by the database trigger on auth.users insert (see below)
      } else {
        const { error: signInError } =
          await supabase.auth.signInWithPassword({ email, password });

        if (signInError) throw signInError;

        // Ensure profile exists on login (covers trigger-missed cases)
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
      }

      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "操作失败，请稍后重试";
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
          <h1 className="text-3xl font-semibold text-glow-gold">
            Midnight Diary
          </h1>
          <p className="text-muted text-sm">
            {mode === "login" ? "欢迎回来，夜行者" : "开始你的深夜旅程"}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted/60" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="昵称"
                className="w-full h-12 pl-10 pr-4 rounded-xl bg-white/5 border border-white/10 text-foreground placeholder:text-muted/50 focus:outline-none focus:border-glow-gold/50 transition-colors"
              />
            </div>
          )}

          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted/60" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="邮箱"
              required
              className="w-full h-12 pl-10 pr-4 rounded-xl bg-white/5 border border-white/10 text-foreground placeholder:text-muted/50 focus:outline-none focus:border-glow-gold/50 transition-colors"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted/60" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="密码"
              required
              minLength={6}
              className="w-full h-12 pl-10 pr-4 rounded-xl bg-white/5 border border-white/10 text-foreground placeholder:text-muted/50 focus:outline-none focus:border-glow-gold/50 transition-colors"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400/90 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-glow-gold text-midnight font-semibold hover:bg-glow-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "login" ? "进入深夜" : "注册"}
          </button>
        </form>

        {/* Toggle mode */}
        <p className="text-center text-sm text-muted">
          {mode === "login" ? "还没有账号？" : "已有账号？"}
          <button
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
            className="ml-1 text-glow-gold/80 hover:text-glow-gold underline underline-offset-4 transition-colors"
          >
            {mode === "login" ? "立即注册" : "去登录"}
          </button>
        </p>
      </motion.div>
    </main>
  );
}
