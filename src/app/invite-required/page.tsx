"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, KeyRound } from "lucide-react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

export default function InviteRequiredPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);
  const isSubmittingRef = useRef(false);

  // ── 页面加载时预检：已验证用户直接跳转主页 ──
  useEffect(() => {
    async function preCheck() {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setChecking(false);
          return;
        }
        const { data: profile } = await supabase
          .from("profiles")
          .select("invite_code_id, role")
          .eq("id", session.user.id)
          .eq("is_deleted", false)
          .single();

        if (profile?.invite_code_id || profile?.role === "admin") {
          // 已验证通过 — 直接跳转
          window.location.href = "/";
          return;
        }
      } catch (err) {
        console.error("[invite-required] pre-check error:", err);
      }
      setChecking(false);
    }
    preCheck();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError("请输入邀请码");
      return;
    }

    // ── useRef 提交锁 — 铁律：禁止多次提交 ──
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/consume-invite-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("[invite-required] API error:", res.status, data);

        // 409 特殊处理：可能是自己已绑定但 API 遗漏 — 重新检查 profile
        if (res.status === 409) {
          try {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
              const { data: profile } = await supabase
                .from("profiles")
                .select("invite_code_id")
                .eq("id", session.user.id)
                .eq("is_deleted", false)
                .single();

              if (profile?.invite_code_id) {
                // 自己已绑定 — 视为成功，直接跳转
                window.location.href = "/";
                return;
              }
            }
          } catch (recheckErr) {
            console.error("[invite-required] re-check error:", recheckErr);
          }
        }

        setError(data.error || "验证失败，请重试");
        setLoading(false);
        isSubmittingRef.current = false;
        return;
      }

      // ── 成功 — 硬跳转确保 middleware 看到最新 profile ──
      // 不重置 loading，保持按钮 disabled 直到页面跳转完成
      console.log("[invite-required] invite code consumed successfully, redirecting...");
      window.location.href = "/";
    } catch (err) {
      console.error("[invite-required] network error:", err);
      setError("网络错误，请重试");
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  // 预检中 — 显示加载动画
  if (checking) {
    return (
      <main className="flex flex-1 items-center justify-center min-h-screen bg-midnight">
        <Loader2 className="h-8 w-8 animate-spin text-glow-gold/60" />
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm space-y-8"
      >
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-glow-gold/10 flex items-center justify-center">
              <KeyRound className="h-7 w-7 text-glow-gold" />
            </div>
          </div>
          <h1 className="text-2xl font-semibold text-glow-gold">内测邀请</h1>
          <p className="text-muted text-sm leading-relaxed">
            深空回响正处于内测阶段，
            <br />
            请输入邀请码开始使用。
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="MD-XXXX-XXXX-XXXX"
            autoFocus
            autoCapitalize="characters"
            disabled={loading}
            className="w-full h-12 px-4 rounded-xl bg-white/5 border border-white/10 text-foreground placeholder:text-muted/50 focus:outline-none focus:border-glow-gold/50 transition-colors text-center tracking-wider disabled:opacity-50"
          />

          {error && (
            <p className="text-sm text-red-400/90 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="w-full h-12 rounded-xl bg-glow-gold text-midnight font-semibold hover:bg-glow-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "验证中..." : "验证并进入"}
          </button>
        </form>
      </motion.div>
    </main>
  );
}
