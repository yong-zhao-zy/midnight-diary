"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Save,
  Plus,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_PROMPTS,
  PROMPT_META,
  PROMPT_TYPES,
  type PromptType,
  type PromptConfigRow,
} from "@/lib/prompt-defaults";

function PromptsConsole() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const rawType = searchParams.get("type") as PromptType | null;
  const type: PromptType =
    rawType && PROMPT_TYPES.includes(rawType) ? rawType : "guide";

  const [versions, setVersions] = useState<PromptConfigRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSaveAsModal, setShowSaveAsModal] = useState(false);
  const [newVersionName, setNewVersionName] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 2500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const loadVersions = useCallback(
    async (t: PromptType) => {
      setLoading(true);

      // Session refresh / auth guard
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        const { data: refreshData } = await supabase.auth.refreshSession();
        if (!refreshData.session) {
          router.push("/login");
          return;
        }
      }

      const res = await fetch(`/api/prompts?type=${t}`);
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      const list: PromptConfigRow[] = data.versions || [];
      setVersions(list);

      // 默认选中生效版本
      const active = list.find((v) => v.is_active);
      if (active) {
        setSelectedId(active.id);
        setEditorContent(active.content);
      } else if (list.length > 0) {
        setSelectedId(list[0].id);
        setEditorContent(list[0].content);
      } else {
        setSelectedId(null);
        setEditorContent("");
      }
      setLoading(false);
    },
    [router]
  );

  useEffect(() => {
    loadVersions(type);
  }, [type, loadVersions]);

  const switchTab = (t: PromptType) => {
    router.push(`/my/prompts?type=${t}`);
  };

  const selectVersion = (v: PromptConfigRow) => {
    setSelectedId(v.id);
    setEditorContent(v.content);
  };

  const handleSave = async () => {
    const selected = versions.find((v) => v.id === selectedId);
    if (!selected || Number(selected.version_number) === 1.0) return;

    setSaving(true);
    try {
      const res = await fetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          action: "save",
          id: selected.id,
          content: editorContent,
        }),
      });
      if (res.ok) {
        showToast("保存成功");
        loadVersions(type);
      } else {
        const err = await res.json();
        showToast(err.error || "保存失败");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAs = async () => {
    if (!newVersionName.trim()) return;

    setSaving(true);
    try {
      const res = await fetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          action: "saveAs",
          name: newVersionName.trim(),
          content: editorContent,
        }),
      });
      if (res.ok) {
        setShowSaveAsModal(false);
        setNewVersionName("");
        showToast("新版本已创建并设为生效");
        loadVersions(type);
      } else {
        const err = await res.json();
        showToast(err.error || "另存失败");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSetActive = async (id: string) => {
    const res = await fetch("/api/prompts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      showToast("已切换生效版本");
      loadVersions(type);
    } else {
      showToast("切换失败");
    }
  };

  const handleRestoreDefault = () => {
    setEditorContent(DEFAULT_PROMPTS[type]);
    showToast("已载入系统默认模板（需另存为新版本才生效）");
  };

  const selected = versions.find((v) => v.id === selectedId);
  const isSystemDefault = selected
    ? Number(selected.version_number) === 1.0
    : true;

  return (
    <div className="min-h-screen bg-midnight text-foreground">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center px-4 pt-[max(0.75rem,env(safe-area-inset-top,0.75rem))] pb-3 bg-midnight/80 backdrop-blur-md border-b border-white/5">
        <button
          onClick={() => router.push("/my")}
          className="h-10 w-10 flex items-center justify-center rounded-full text-muted/50 hover:text-foreground hover:bg-white/10 transition-colors"
        >
          <ArrowLeft className="h-4.5 w-4.5" />
        </button>
        <h1 className="flex-1 text-center text-sm font-medium text-foreground/90 pr-10">
          提示词实验坊
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 py-3 bg-midnight/60 border-b border-white/5 overflow-x-auto">
        {PROMPT_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => switchTab(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all border ${
              type === t
                ? "bg-glow-gold/20 text-glow-gold border-glow-gold/30"
                : "text-muted/50 hover:text-foreground/70 hover:bg-white/5 border-transparent"
            }`}
          >
            {PROMPT_META[t].icon} {PROMPT_META[t].tab}
          </button>
        ))}
      </div>

      {/* Main: 双栏分屏 */}
      <div className="max-w-5xl mx-auto px-4 py-5 flex flex-col md:flex-row gap-4">
        {/* 左侧版本流 */}
        <div className="w-full md:w-1/3 space-y-2 md:max-h-[calc(100vh-12rem)] md:overflow-y-auto md:pr-1">
          {loading ? (
            <div className="py-8 text-center text-xs text-muted/50">
              加载中...
            </div>
          ) : versions.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted/50">
              暂无版本
            </div>
          ) : (
            versions.map((v) => {
              const isActive = v.is_active;
              const isSelected = selectedId === v.id;
              return (
                <div
                  key={v.id}
                  onClick={() => selectVersion(v)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    isActive
                      ? "border-glow-gold/50 bg-glow-gold/[0.06]"
                      : "border-white/8 bg-white/[0.02] hover:border-white/15"
                  } ${isSelected ? "ring-1 ring-glow-gold/30" : ""}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-foreground/85 truncate">
                      v{v.version_number} {v.name}
                    </span>
                    {isActive && (
                      <span className="text-[10px] text-glow-gold flex items-center gap-0.5 shrink-0 ml-2">
                        <Check className="h-3 w-3" /> 当前生效
                      </span>
                    )}
                  </div>
                  {!isActive && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSetActive(v.id);
                      }}
                      className="text-[10px] text-muted/50 hover:text-glow-gold/70 transition-colors mt-0.5"
                    >
                      设为生效
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* 右侧编辑器 */}
        <div className="w-full md:w-2/3 flex flex-col">
          <div className="flex-1 flex flex-col rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
            <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between">
              <span className="text-[11px] text-muted/50">
                {selected
                  ? `v${selected.version_number} ${selected.name}`
                  : "未选择版本"}
              </span>
              <span className="text-[10px] text-muted/40">
                用 {"{{var}}"} 占位符注入动态变量
              </span>
            </div>
            <textarea
              value={editorContent}
              onChange={(e) => setEditorContent(e.target.value)}
              className="flex-1 w-full p-3 bg-transparent text-xs leading-relaxed font-mono text-foreground/80 resize-none focus:outline-none"
              style={{ minHeight: "320px" }}
              placeholder="选择左侧版本加载提示词..."
              spellCheck={false}
            />
          </div>

          {/* 底部按钮 */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setShowSaveAsModal(true)}
              className="flex-1 py-2.5 rounded-xl bg-glow-gold/20 text-glow-gold text-xs font-medium hover:bg-glow-gold/30 transition-colors flex items-center justify-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" /> 另存为新版本
            </button>
            <button
              onClick={handleSave}
              disabled={isSystemDefault || saving}
              className="flex-1 py-2.5 rounded-xl bg-white/5 text-foreground/70 text-xs font-medium hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1"
              title={
                isSystemDefault
                  ? "系统自带模板请使用另存为新版本"
                  : "保存修改到当前版本"
              }
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              保存修改
            </button>
            <button
              onClick={handleRestoreDefault}
              className="py-2.5 px-4 rounded-xl bg-white/5 text-muted/60 text-xs font-medium hover:bg-white/10 transition-colors flex items-center justify-center gap-1"
            >
              <RotateCcw className="h-3.5 w-3.5" /> 恢复默认
            </button>
          </div>
          {isSystemDefault && selected && (
            <p className="text-[10px] text-muted/40 mt-1.5 text-center">
              系统自带模板请使用「另存为新版本」
            </p>
          )}
        </div>
      </div>

      {/* SaveAs Modal */}
      {showSaveAsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => {
            setShowSaveAsModal(false);
            setNewVersionName("");
          }}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-midnight p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-medium text-foreground/90">
              另存为新版本
            </h3>
            <p className="text-[11px] text-muted/50">
              当前编辑内容将保存为新版本并自动设为生效，原有版本转为历史存档。
            </p>
            <input
              value={newVersionName}
              onChange={(e) => setNewVersionName(e.target.value)}
              placeholder="输入版本名称，如：温柔加强版"
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-foreground/80 focus:outline-none focus:border-glow-gold/40"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveAs();
              }}
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowSaveAsModal(false);
                  setNewVersionName("");
                }}
                className="flex-1 py-2.5 rounded-xl bg-white/5 text-muted/60 text-xs hover:bg-white/10 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveAs}
                disabled={!newVersionName.trim() || saving}
                className="flex-1 py-2.5 rounded-xl bg-glow-gold/20 text-glow-gold text-xs font-medium hover:bg-glow-gold/30 transition-colors disabled:opacity-30 flex items-center justify-center gap-1"
              >
                {saving && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                确认创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom,1rem))] left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-glow-gold/20 text-glow-gold text-xs font-medium backdrop-blur-md whitespace-nowrap">
          {toast}
        </div>
      )}
    </div>
  );
}

export default function PromptsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center text-xs text-white/30 animate-pulse">
          正在加载控制台...
        </div>
      }
    >
      <PromptsConsole />
    </Suspense>
  );
}
