"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, KeyRound } from "lucide-react";
import { motion } from "framer-motion";

export default function InviteRequiredPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError("请输入邀请码");
      return;
    }

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
        setError(data.error || "验证失败，请重试");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("网络错误，请重试");
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
            className="w-full h-12 px-4 rounded-xl bg-white/5 border border-white/10 text-foreground placeholder:text-muted/50 focus:outline-none focus:border-glow-gold/50 transition-colors text-center tracking-wider"
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
            验证并进入
          </button>
        </form>
      </motion.div>
    </main>
  );
}
