"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, Lock, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const passwordMismatch = confirmPassword && password !== confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("密码至少 6 位");
      return;
    }
    if (password !== confirmPassword) {
      setError("两次密码不一致");
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) throw updateError;
      setSuccess(true);

      setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 2000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "更新失败，请重试";
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
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-semibold text-glow-gold">设置新密码</h1>
          <p className="text-muted text-sm">请输入你的新密码</p>
        </div>

        {success ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-4 py-8"
          >
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-glow-gold/10 flex items-center justify-center">
                <CheckCircle className="h-7 w-7 text-glow-gold" />
              </div>
            </div>
            <p className="text-foreground">密码已更新成功</p>
            <p className="text-sm text-muted">正在跳转...</p>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted/60" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="新密码（至少 6 位）"
                required
                minLength={6}
                className="w-full h-12 pl-10 pr-4 rounded-xl bg-white/5 border border-white/10 text-foreground placeholder:text-muted/50 focus:outline-none focus:border-glow-gold/50 transition-colors"
              />
            </div>

            <div className="space-y-1">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted/60" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="确认新密码"
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

            {error && (
              <p className="text-sm text-red-400/90 text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !!passwordMismatch}
              className="w-full h-12 rounded-xl bg-glow-gold text-midnight font-semibold hover:bg-glow-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              确认修改
            </button>
          </form>
        )}
      </motion.div>
    </main>
  );
}
