"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Plus, Trash2, Copy, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

interface InviteCode {
  id: string;
  code: string;
  note: string;
  used_by: string | null;
  used_at: string | null;
  created_at: string;
  created_by: string | null;
}

type FilterTab = "all" | "unused" | "used";

export default function InviteCodesAdminPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [showGenerate, setShowGenerate] = useState(false);
  const [genCount, setGenCount] = useState(5);
  const [genNote, setGenNote] = useState("");
  const [genLoading, setGenLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fetchCodes = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/invite-codes");
    const data = await res.json();
    if (data.codes) {
      setCodes(data.codes);
    }
    setLoading(false);
  }, []);

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

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session!.user.id)
        .single();

      if (profile?.role !== "admin") {
        setAuthChecked(true);
        setIsAdmin(false);
        return;
      }

      setIsAdmin(true);
      setAuthChecked(true);
      await fetchCodes();
    }
    init();
  }, [router, fetchCodes]);

  const handleGenerate = async () => {
    setGenLoading(true);
    try {
      const res = await fetch("/api/admin/invite-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: genCount, note: genNote }),
      });
      const data = await res.json();
      if (data.codes) {
        await fetchCodes();
        setShowGenerate(false);
        setGenNote("");
      }
    } finally {
      setGenLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch("/api/admin/invite-codes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setCodes((prev) => prev.filter((c) => c.id !== id));
    }
    setDeleteConfirmId(null);
  };

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredCodes = codes.filter((c) => {
    if (activeTab === "unused") return !c.used_by;
    if (activeTab === "used") return !!c.used_by;
    return true;
  });

  const total = codes.length;
  const used = codes.filter((c) => c.used_by).length;
  const remaining = total - used;

  if (!authChecked) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-glow-gold/60" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-midnight text-foreground flex flex-col items-center justify-center px-6">
        <p className="text-lg font-semibold text-muted">无权访问</p>
        <p className="text-sm text-muted/60 mt-2">此页面仅限管理员访问</p>
        <button
          onClick={() => router.push("/")}
          className="mt-6 px-5 py-2 rounded-full bg-glow-gold/90 text-midnight text-sm font-medium hover:bg-glow-gold transition-colors"
        >
          返回首页
        </button>
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
          内测码管理
        </h1>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
            <p className="text-2xl font-semibold text-foreground/90">{total}</p>
            <p className="text-xs text-muted/60 mt-1">总码数</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
            <p className="text-2xl font-semibold text-glow-gold/80">{used}</p>
            <p className="text-xs text-muted/60 mt-1">已使用</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
            <p className="text-2xl font-semibold text-emerald-400/80">{remaining}</p>
            <p className="text-xs text-muted/60 mt-1">剩余</p>
          </div>
        </div>

        {/* Batch Generate Button */}
        <button
          onClick={() => setShowGenerate(true)}
          className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-glow-gold/90 text-midnight font-medium text-sm hover:bg-glow-gold transition-colors"
        >
          <Plus className="h-4 w-4" />
          批量生成
        </button>

        {/* Filter Tabs */}
        <div className="flex gap-1 p-1 rounded-full bg-white/[0.04] border border-white/10">
          {([
            { key: "all", label: "全部" },
            { key: "unused", label: "未使用" },
            { key: "used", label: "已使用" },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2 rounded-full text-xs font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-glow-gold/90 text-midnight"
                  : "text-muted/70 hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div className="py-16 text-center text-xs text-muted/50">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
            加载中...
          </div>
        ) : filteredCodes.length === 0 ? (
          <div className="py-16 text-center text-xs text-muted/50">
            暂无内测码
          </div>
        ) : (
          <div className="space-y-2">
            {filteredCodes.map((code) => (
              <div
                key={code.id}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <code className="text-sm font-mono text-glow-gold/90 tracking-wider truncate">
                      {code.code}
                    </code>
                    <button
                      onClick={() => handleCopy(code.code, code.id)}
                      className="shrink-0 p-1 rounded text-muted/50 hover:text-foreground transition-colors"
                    >
                      {copiedId === code.id ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                  {code.used_by ? (
                    <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/10 text-muted">
                      已使用
                    </span>
                  ) : (
                    <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-400">
                      未使用
                    </span>
                  )}
                </div>

                {code.note && (
                  <p className="text-xs text-muted/60 truncate">
                    备注：{code.note}
                  </p>
                )}

                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] text-muted/40">
                    {new Date(code.created_at).toLocaleString("zh-CN", {
                      month: "numeric",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {code.used_at && (
                      <span className="ml-2">
                        · 使用于 {new Date(code.used_at).toLocaleString("zh-CN", {
                          month: "numeric",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                  </p>

                  {!code.used_by && (
                    deleteConfirmId === code.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(code.id)}
                          className="text-[10px] px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                        >
                          确认删除
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="p-1 rounded text-muted/50 hover:text-foreground transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(code.id)}
                        className="p-1 rounded text-muted/40 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Batch Generate Modal */}
      <AnimatePresence>
        {showGenerate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-6"
          >
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowGenerate(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-midnight/95 p-6 space-y-5"
            >
              <h2 className="text-lg font-semibold text-foreground">批量生成内测码</h2>

              <div className="space-y-2">
                <label className="text-xs text-muted/60">数量（1-100）</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={genCount}
                  onChange={(e) => {
                    const v = parseInt(e.target.value) || 1;
                    setGenCount(Math.min(100, Math.max(1, v)));
                  }}
                  className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-foreground focus:outline-none focus:border-glow-gold/50 transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-muted/60">备注（可选）</label>
                <input
                  type="text"
                  value={genNote}
                  onChange={(e) => setGenNote(e.target.value)}
                  placeholder="如：内测一批"
                  className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-foreground placeholder:text-muted/40 focus:outline-none focus:border-glow-gold/50 transition-colors"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowGenerate(false)}
                  className="flex-1 h-11 rounded-xl border border-white/10 text-muted/70 text-sm hover:bg-white/5 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={genLoading}
                  className="flex-1 h-11 rounded-xl bg-glow-gold text-midnight font-medium text-sm hover:bg-glow-gold/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {genLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  生成
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
