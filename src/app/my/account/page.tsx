"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useDiaryStore } from "@/store/diary-store";

export default function AccountPage() {
  const router = useRouter();
  const resetStore = useDiaryStore((s) => s.reset);

  const [authChecked, setAuthChecked] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState("");
  const [countdown, setCountdown] = useState(3);

  // Auth guard — 与 /admin/invite-codes 和 /my/archive 一致
  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const { data: refreshData } = await supabase.auth.refreshSession();
        if (!refreshData.session) {
          router.push("/login");
          return;
        }
      }
      setAuthChecked(true);
    }
    init();
  }, [router]);

  // 3 秒倒计时 — 弹窗打开后确认按钮禁用 3 秒
  useEffect(() => {
    if (!showConfirm) {
      setCountdown(3);
      return;
    }
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [showConfirm, countdown]);

  // Toast 自动消失（5s）
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 5000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setDeleting(false);
        setToast(data.error || "注销失败，请联系管理员");
        return;
      }

      // 成功 — 清除本地所有存储
      const supabase = createClient();
      await supabase.auth.signOut();
      resetStore();

      // 清除 sessionStorage（引导提问缓存等）
      sessionStorage.clear();

      // 清除 localStorage
      localStorage.clear();

      // 清除 Service Worker 缓存
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }

      // 注销 Service Worker 注册
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((r) => r.unregister()));
      }

      setToast("账号已注销");

      // 1.5s 后跳转登录页（让 toast 可见）
      setTimeout(() => {
        router.push("/login");
        router.refresh();
      }, 1500);
    } catch {
      setDeleting(false);
      setToast("注销失败，请联系管理员");
    }
  };

  if (!authChecked) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen bg-midnight">
        <Loader2 className="h-8 w-8 animate-spin text-glow-gold/60" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-midnight text-foreground">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center px-4 pt-[max(0.75rem,env(safe-area-inset-top,0.75rem))] pb-3 bg-midnight/80 backdrop-blur-md border-b border-white/5">
        <button
          onClick={() => router.back()}
          className="h-10 w-10 flex items-center justify-center rounded-full text-muted/50 hover:text-foreground hover:bg-white/10 transition-colors"
        >
          <ArrowLeft className="h-4.5 w-4.5" />
        </button>
        <h1 className="flex-1 text-center text-sm font-medium text-foreground/90 pr-10">
          账号设置
        </h1>
      </div>

      {/* Content */}
      <div className="max-w-md mx-auto px-5 py-8 space-y-6">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-sm text-muted/70 leading-relaxed">
            此操作将永久删除您的所有日记、报告、维度配置等账号记录，且无法恢复。
          </p>
        </div>

        <button
          onClick={() => setShowConfirm(true)}
          className="w-full h-12 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 font-medium text-sm hover:bg-red-500/20 transition-colors"
        >
          注销账号
        </button>
      </div>

      {/* Confirmation Dialog — 3 秒倒计时防误触 */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-6"
          >
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => !deleting && setShowConfirm(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-midnight/95 p-6 space-y-5"
            >
              <h2 className="text-lg font-semibold text-foreground">确认注销</h2>
              <p className="text-sm text-muted/80 leading-relaxed">
                一旦注销，所有日记与账号记录将被永久删除，无法恢复。是否确认注销？
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => !deleting && setShowConfirm(false)}
                  disabled={deleting}
                  className="flex-1 h-11 rounded-xl border border-white/10 text-muted/70 text-sm hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={deleting || countdown > 0}
                  className="flex-1 h-11 rounded-xl bg-red-500 text-white font-medium text-sm hover:bg-red-500/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      注销中...
                    </>
                  ) : countdown > 0 ? (
                    `请等待 ${countdown}s`
                  ) : (
                    "确认注销"
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 px-4 py-3 rounded-xl bg-glow-gold/10 border border-glow-gold/20 text-sm text-glow-gold whitespace-nowrap"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
