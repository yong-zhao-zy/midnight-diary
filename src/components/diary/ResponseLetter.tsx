"use client";

import { useState, useRef, useEffect, type ChangeEvent } from "react";
import { motion } from "framer-motion";
import { Send, Loader2, Pencil, RotateCcw, Calendar } from "lucide-react";
import {
  appendChatHistory,
  resetChatHistory,
  getDiaryEffectiveDate,
  type DiaryRow,
  type DiaryContent,
  type ChatMessage,
} from "@/lib/diary-service";
import { DiaryEditView } from "./DiaryEditView";
import {
  type ModuleConfig,
  DEFAULT_MODULE_CONFIG,
  getActiveModules,
  getPrefixedLabel,
  getLabelWithHistory,
  LEGACY_KEY_MAP,
} from "@/lib/module-config";
import { OFFICIAL_EXPERTS, type CustomExpertTags } from "@/config/experts-config";

// Local YYYY-MM-DD from a Date (avoids UTC off-by-one from toISOString)
function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface ResponseLetterProps {
  entry: DiaryRow;
  moduleConfig?: ModuleConfig[];
  onClick?: () => void;
}

/**
 * Resolve content for a module ID, falling back to legacy keys.
 */
function resolveContent(content: Record<string, string>, moduleId: string): string {
  if (content[moduleId]) return content[moduleId];
  for (const [legacyKey, newId] of Object.entries(LEGACY_KEY_MAP)) {
    if (newId === moduleId && content[legacyKey]) {
      return content[legacyKey];
    }
  }
  return "";
}

function getFirstAiResponse(history: ChatMessage[]): string {
  const msg = history.find((m) => m.type === "ai");
  return msg?.content || "";
}

function getSummary(content: Record<string, string>, config: ModuleConfig[]): string {
  // Try to find first non-empty module content in config order
  for (const mod of config) {
    const value = resolveContent(content, mod.id);
    if (value?.trim()) return value.trim().slice(0, 24);
  }
  return "未命名日记";
}

export function ResponseLetter({ entry, moduleConfig, onClick }: ResponseLetterProps) {
  const config = moduleConfig || DEFAULT_MODULE_CONFIG;
  const date = getDiaryEffectiveDate(entry);
  const formatted = `${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
  const aiPreview = getFirstAiResponse(entry.chat_history);

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      onClick={onClick}
      className="relative rounded-2xl border border-glow-gold/20 bg-white/[0.03] p-5 shadow-[0_0_24px_-8px_rgba(253,230,138,0.15)] cursor-pointer hover:border-glow-gold/40 hover:bg-white/[0.05] active:scale-[0.98] transition-all"
    >
      <div className="absolute inset-0 rounded-2xl pointer-events-none ring-1 ring-inset ring-glow-gold/10" />
      <time className="text-xs text-muted block mb-3">{formatted}</time>
      <h3 className="text-sm font-semibold text-foreground/80 mb-2 line-clamp-1">
        {getSummary(entry.content, config)}
      </h3>
      {aiPreview && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <p className="text-sm text-foreground/70 leading-relaxed line-clamp-3 whitespace-pre-wrap">
            {aiPreview}
          </p>
        </div>
      )}
    </motion.article>
  );
}

/* ─── Detail Drawer ─── */

interface DiaryDetailProps {
  entry: DiaryRow;
  isLatest: boolean;
  onClose: () => void;
  onEntryUpdated?: (updated: DiaryRow) => void;
  moduleConfig?: ModuleConfig[];
  expertStyle?: string;
  customExpertTags?: CustomExpertTags | null;
}

export function DiaryDetail({
  entry,
  isLatest,
  onClose,
  onEntryUpdated,
  moduleConfig: externalConfig,
  expertStyle,
  customExpertTags,
}: DiaryDetailProps) {
  const moduleConfig = externalConfig || DEFAULT_MODULE_CONFIG;
  const activeModules = getActiveModules(moduleConfig);

  const date = getDiaryEffectiveDate(entry);
  const formatted = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(entry.chat_history);
  const [content, setContent] = useState<DiaryContent>(entry.content);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState(false);
  const [toast, setToast] = useState("");
  const [diaryDate, setDiaryDate] = useState<string>(() => toLocalDateStr(date));
  const [isUpdating, setIsUpdating] = useState(false);
  const today = toLocalDateStr(new Date());
  const scrollRef = useRef<HTMLDivElement>(null);

  const conversations = chatHistory.filter((m) => m.type !== "reference");

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 2500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // Sync diaryDate when entry prop updates (e.g. parent re-fetch)
  useEffect(() => {
    setDiaryDate(toLocalDateStr(getDiaryEffectiveDate(entry)));
  }, [entry.diary_date, entry.created_at]);

  const handleDateChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    if (!newDate || newDate === diaryDate || isUpdating) return;
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/diaries/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diaryDate: newDate }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast(data.error || "日期修改失败");
        return;
      }
      setDiaryDate(newDate);
      setToast("日期修改成功，已重构该天的时空记忆");
      onEntryUpdated?.({
        ...entry,
        diary_date: newDate,
      });
    } catch {
      setToast("网络异常，请重试");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleEditSaved = (newContent: DiaryContent) => {
    setContent(newContent);
    setEditing(false);
    setToast("内容已更新");
    onEntryUpdated?.({ ...entry, content: newContent, chat_history: chatHistory });
  };

  const handleReinterpret = async () => {
    setSending(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, reinterpret: true, moduleConfig: activeModules, expertStyle, customExpertTags }),
      });
      const data = await res.json();
      const aiReply = data.message || "回信未能送达。";

      const resolvedName = expertStyle === "custom"
        ? "自定义顾问"
        : (OFFICIAL_EXPERTS.find((e) => e.id === expertStyle) ?? OFFICIAL_EXPERTS[0]).name;
      const expertInfo = { style: expertStyle || "warm_companion", name: resolvedName };

      const newHistory: ChatMessage[] = [
        { type: "reference", label: "日记原文", content: "" },
        { type: "ai", label: "重新解读", content: aiReply, expertStyle: expertInfo.style, expertName: expertInfo.name },
      ];
      setChatHistory(newHistory);
      await resetChatHistory(entry.id, aiReply, expertInfo);
      onEntryUpdated?.({ ...entry, content, chat_history: newHistory });
      setToast("已重新解读");
    } catch {
      setToast("请求失败，请重试");
    } finally {
      setSending(false);
    }
  };

  const handleFollowUp = async () => {
    const question = input.trim();
    if (!question || sending) return;

    if (question === "重新解读") {
      setInput("");
      await handleReinterpret();
      return;
    }

    setInput("");
    setSending(true);

    const updatedHistory: ChatMessage[] = [
      ...chatHistory,
      { type: "user", label: "追问", content: question },
    ];
    setChatHistory(updatedHistory);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          chatHistory: updatedHistory,
          followUp: question,
          moduleConfig: activeModules,
          expertStyle,
          customExpertTags,
        }),
      });
      const data = await res.json();
      const aiReply = data.message || "回信未能送达，请稍后重试。";

      const finalHistory: ChatMessage[] = [
        ...updatedHistory,
        { type: "ai", label: "回响", content: aiReply },
      ];
      setChatHistory(finalHistory);
      await appendChatHistory(entry.id, question, aiReply);
    } catch {
      setChatHistory([
        ...updatedHistory,
        { type: "ai", label: "回响", content: "深夜的信号中断了，请稍后再试。" },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-end justify-center"
    >
      <div
        className="absolute inset-0 bg-midnight/80 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="relative z-10 w-full max-w-md max-h-[90vh] rounded-t-3xl border-t border-glow-gold/20 bg-gradient-to-b from-deep-blue to-midnight overflow-hidden flex flex-col"
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-foreground/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pb-4 border-b border-white/5">
          <div className="relative group cursor-pointer flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-muted/40 group-hover:text-muted/70 transition-colors shrink-0" />
            <time className="text-sm text-muted group-hover:text-foreground/80 transition-colors">
              {formatted}
            </time>
            {isUpdating && (
              <Loader2 className="h-3 w-3 animate-spin text-glow-gold/70 shrink-0" />
            )}
            <input
              type="date"
              max={today}
              value={diaryDate}
              onChange={handleDateChange}
              disabled={isUpdating}
              aria-label="修改日记日期"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            />
          </div>
          <div className="flex items-center gap-3">
            {isLatest && !editing && (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="text-sm text-muted hover:text-glow-gold flex items-center gap-1 transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span>编辑</span>
                </button>
                <button
                  onClick={handleReinterpret}
                  disabled={sending}
                  className="text-sm text-muted hover:text-glow-gold flex items-center gap-1 transition-colors disabled:opacity-40"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>重新解读</span>
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="text-sm text-glow-gold/80 hover:text-glow-gold transition-colors"
            >
              返回
            </button>
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div className="mx-6 mt-3 px-4 py-2 rounded-lg bg-glow-gold/10 border border-glow-gold/20 text-sm text-glow-gold text-center">
            {toast}
          </div>
        )}

        {/* Scrollable content */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-6 py-5 space-y-6 overscroll-contain"
        >
          {editing ? (
            /* ─── Full Edit Mode ─── */
            <DiaryEditView
              diaryId={entry.id}
              initialContent={content}
              onSaved={handleEditSaved}
              onCancel={() => setEditing(false)}
              moduleConfig={moduleConfig}
            />
          ) : (
            <>
              {/* Read-only diary content — iterate via moduleConfig, never raw keys */}
              <section className="space-y-4">
                <h3 className="text-xs text-muted uppercase tracking-wider">
                  我的记录
                </h3>
                {moduleConfig.map((mod, idx) => {
                  const value = resolveContent(content as Record<string, string>, mod.id);
                  if (!value || !value.trim()) return null;

                  const { label, renamed, originalLabel } = getLabelWithHistory(
                    mod.id,
                    moduleConfig,
                    entry.module_labels_snapshot
                  );

                  return (
                    <div key={mod.id} className="space-y-1">
                      <span className="text-xs text-glow-gold/60">
                        {getPrefixedLabel(label, idx)}
                        {renamed && originalLabel && (
                          <span className="text-muted/40 ml-1">
                            (原名: {originalLabel})
                          </span>
                        )}
                      </span>
                      <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                        {value}
                      </p>
                    </div>
                  );
                })}
              </section>

              {/* Chat history */}
              {conversations.length > 0 && (
                <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs text-muted uppercase tracking-wider">
                      对话回响
                    </h3>
                    {(() => {
                      // Read expert name from snapshot stored in first AI message
                      const firstAi = conversations.find((m) => m.type === "ai");
                      const snapshotName = firstAi?.expertName;
                      if (!snapshotName) return null;
                      return (
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-glow-gold/10 text-glow-gold/70 border border-glow-gold/20">
                          {snapshotName}
                        </span>
                      );
                    })()}
                  </div>
                  {conversations.map((msg, i) => (
                    <div
                      key={i}
                      className={
                        msg.type === "ai"
                          ? "rounded-xl border border-glow-gold/15 bg-white/[0.02] p-5 shadow-[0_0_32px_-12px_rgba(253,230,138,0.1)]"
                          : "pl-4 border-l-2 border-glow-gold/30 py-2"
                      }
                    >
                      <p className="text-xs text-glow-gold/50 mb-1">{msg.label}</p>
                      <p className="text-sm text-foreground/85 leading-7 whitespace-pre-wrap">
                        {msg.content}
                      </p>
                    </div>
                  ))}

                  {sending && (
                    <div className="flex items-center gap-2 text-muted text-sm py-2">
                      <Loader2 className="h-4 w-4 animate-spin text-glow-gold/70" />
                      <span className="animate-pulse">咨询师正在深思...</span>
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </div>

        {/* Follow-up input (hidden during edit) */}
        {!editing && (
          <div className="px-6 py-4 border-t border-white/5 bg-midnight/50">
            <p className="text-xs text-muted/60 mb-2">
              关于这份回响，你还想对咨询师说点什么？
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                    handleFollowUp();
                  }
                }}
                placeholder={'写下你的想法...（输入"重新解读"可刷新回响）'}
                disabled={sending}
                className="flex-1 h-10 px-4 rounded-full bg-white/5 border border-white/10 text-sm text-foreground placeholder:text-muted/40 focus:outline-none focus:border-glow-gold/50 disabled:opacity-50 transition-colors"
              />
              <button
                onClick={handleFollowUp}
                disabled={!input.trim() || sending}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-glow-gold/90 text-midnight disabled:opacity-30 disabled:cursor-not-allowed hover:bg-glow-gold active:scale-95 transition-all"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
