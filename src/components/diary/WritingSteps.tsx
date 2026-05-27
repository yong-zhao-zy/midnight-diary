"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Loader2,
  Check,
  Send,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  saveDiaryToCloud,
  upsertDraftToCloud,
  appendChatHistory,
  type ChatMessage,
} from "@/lib/diary-service";
import { saveDraft, loadDraft, clearDraft } from "@/lib/draft";

interface Step {
  key: string;
  label: string;
  prompt: string;
  followUp: string;
}

const STEPS: Step[] = [
  {
    key: "emotion",
    label: "情绪",
    prompt: "此刻你的内心是什么颜色？试着用一个画面描述你现在的感受。",
    followUp: "这种感受是从什么时候开始的？它在提醒你什么？",
  },
  {
    key: "body",
    label: "身体",
    prompt: "闭上眼感受一下，你的身体哪个部位最紧绷？它在承载什么？",
    followUp: "如果这个部位能开口说话，它会对你说什么？",
  },
  {
    key: "social",
    label: "人际",
    prompt: "今天有谁的面孔浮现在你脑海？你们之间发生了什么？",
    followUp: "在那个瞬间，你真正想要的回应是什么？",
  },
  {
    key: "light",
    label: "微光",
    prompt: "回想今天，有没有一个让你嘴角微微上扬的瞬间？哪怕很小。",
    followUp: "是什么让那个瞬间如此珍贵？它映射了你内心的哪个渴望？",
  },
  {
    key: "challenge",
    label: "挑战",
    prompt: "如果明天只做一件让自己骄傲的小事，你会选择什么？",
    followUp: "是什么曾经阻碍你去做这件事？那个障碍现在还在吗？",
  },
];

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction > 0 ? -300 : 300,
    opacity: 0,
  }),
};

type SaveStatus = "idle" | "saving" | "saved";

export function WritingSteps() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [content, setContent] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [draftRestored, setDraftRestored] = useState(false);

  // Post-submit chat state
  const [diaryId, setDiaryId] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore draft on mount
  useEffect(() => {
    const draft = loadDraft();
    if (draft && Object.keys(draft.content).some((k) => draft.content[k]?.trim())) {
      setContent(draft.content);
      setCurrentIndex(draft.currentStep);
      setDraftRestored(true);
      setTimeout(() => setDraftRestored(false), 3000);
    }
  }, []);

  // Debounced local save on content/step change
  useEffect(() => {
    if (Object.keys(content).length === 0) return;

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      saveDraft(content, currentIndex);
      showSaveStatus();
    }, 800);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [content, currentIndex]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatHistory]);

  function showSaveStatus() {
    setSaveStatus("saved");
    if (saveStatusTimer.current) clearTimeout(saveStatusTimer.current);
    saveStatusTimer.current = setTimeout(() => setSaveStatus("idle"), 2000);
  }

  async function syncToCloud() {
    const hasContent = Object.values(content).some((v) => v.trim());
    if (!hasContent) return;

    setSaveStatus("saving");
    try {
      await upsertDraftToCloud(content);
      showSaveStatus();
    } catch {
      // Silent fail
    }
  }

  const step = STEPS[currentIndex];
  const currentValue = content[step.key] || "";
  const showFollowUp = currentValue.length > 10;

  const goTo = useCallback(
    (next: number) => {
      setDirection(next > currentIndex ? 1 : -1);
      setCurrentIndex(next);
    },
    [currentIndex]
  );

  const handleNext = () => {
    goTo(currentIndex + 1);
    syncToCloud();
  };

  const handlePrev = () => {
    goTo(currentIndex - 1);
  };

  const handleSubmit = async () => {
    setLoading(true);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      const message = data.message || "今晚的回信未能送达。";

      // Save to cloud and get diary ID
      const saved = await saveDiaryToCloud(content, message);
      clearDraft();

      // Transition to chat mode
      const initialHistory: ChatMessage[] = [
        { type: "reference", label: "日记原文", content: "" },
        { type: "ai", label: "初次回响", content: message },
      ];
      setChatHistory(initialHistory);
      setDiaryId(saved?.id ?? null);
    } catch {
      const errorHistory: ChatMessage[] = [
        { type: "reference", label: "日记原文", content: "" },
        { type: "ai", label: "初次回响", content: "连接失败，请稍后重试。" },
      ];
      setChatHistory(errorHistory);
    } finally {
      setLoading(false);
    }
  };

  const handleFollowUp = async () => {
    const question = chatInput.trim();
    if (!question || chatSending || !diaryId) return;

    setChatInput("");
    setChatSending(true);

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
        }),
      });
      const data = await res.json();
      const aiReply = data.message || "回信未能送达，请稍后重试。";

      const finalHistory: ChatMessage[] = [
        ...updatedHistory,
        { type: "ai", label: "回响", content: aiReply },
      ];
      setChatHistory(finalHistory);
      await appendChatHistory(diaryId, question, aiReply);
    } catch {
      setChatHistory([
        ...updatedHistory,
        { type: "ai", label: "回响", content: "深夜的信号中断了，请稍后再试。" },
      ]);
    } finally {
      setChatSending(false);
    }
  };

  // ─── Loading state ───
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-20">
        <Loader2 className="h-10 w-10 animate-spin text-glow-gold" />
        <p className="text-muted text-lg animate-pulse">
          专家正在审阅你的心事...
        </p>
      </div>
    );
  }

  // ─── Chat mode: AI has responded, show conversation ───
  if (chatHistory.length > 0) {
    const conversations = chatHistory.filter((m) => m.type !== "reference");

    return (
      <div className="max-w-xl mx-auto w-full flex flex-col gap-6 py-4">
        {/* Chat messages */}
        <div
          ref={chatScrollRef}
          className="space-y-4 max-h-[60vh] overflow-y-auto overscroll-contain pr-1"
        >
          {conversations.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i === conversations.length - 1 ? 0.1 : 0 }}
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
            </motion.div>
          ))}

          {chatSending && (
            <div className="flex items-center gap-2 text-muted text-sm py-2">
              <Loader2 className="h-4 w-4 animate-spin text-glow-gold/70" />
              <span className="animate-pulse">咨询师正在深思...</span>
            </div>
          )}
        </div>

        {/* Chat input */}
        <div className="pt-4 border-t border-white/5">
          <p className="text-xs text-muted/60 mb-2">
            关于这份回响，你还想对咨询师说点什么？
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  handleFollowUp();
                }
              }}
              placeholder="继续和 AI 聊聊..."
              disabled={chatSending || !diaryId}
              className="flex-1 h-10 px-4 rounded-full bg-white/5 border border-white/10 text-sm text-foreground placeholder:text-muted/40 focus:outline-none focus:border-glow-gold/50 disabled:opacity-50 transition-colors"
            />
            <button
              onClick={handleFollowUp}
              disabled={!chatInput.trim() || chatSending || !diaryId}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-glow-gold/90 text-midnight disabled:opacity-30 disabled:cursor-not-allowed hover:bg-glow-gold active:scale-95 transition-all"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Navigation links */}
        <div className="flex justify-center gap-4 pt-2">
          <button
            onClick={() => router.push("/")}
            className="text-sm text-muted underline underline-offset-4 hover:text-glow-gold transition-colors"
          >
            回到首页
          </button>
        </div>
      </div>
    );
  }

  // ─── Step-by-step writing mode ───
  return (
    <div className="max-w-xl mx-auto w-full space-y-8">
      {/* Save status indicator */}
      <div className="flex justify-end min-h-[20px]">
        <AnimatePresence mode="wait">
          {draftRestored && (
            <motion.span
              key="restored"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-xs text-glow-gold/70 flex items-center gap-1"
            >
              <Check className="h-3 w-3" />
              已恢复上次草稿
            </motion.span>
          )}
          {!draftRestored && saveStatus === "saving" && (
            <motion.span
              key="saving"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-xs text-muted/60"
            >
              正在同步...
            </motion.span>
          )}
          {!draftRestored && saveStatus === "saved" && (
            <motion.span
              key="saved"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-xs text-muted/60 flex items-center gap-1"
            >
              <Check className="h-3 w-3" />
              已自动保存
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Progress */}
      <div className="flex items-center justify-center gap-2">
        {STEPS.map((s, i) => (
          <button
            key={s.key}
            onClick={() => goTo(i)}
            className={cn(
              "h-2 rounded-full transition-all duration-300",
              i === currentIndex
                ? "w-8 bg-glow-gold"
                : content[s.key]?.trim()
                  ? "w-3 bg-glow-gold/40"
                  : "w-2 bg-foreground/20"
            )}
          />
        ))}
      </div>

      {/* Step Content */}
      <div className="space-y-5">
        <div className="relative overflow-hidden min-h-[80px]">
          <AnimatePresence custom={direction} mode="wait">
            <motion.div
              key={step.key}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="space-y-2"
            >
              <span className="text-sm text-glow-gold/70 tracking-wide">
                {currentIndex + 1} / {STEPS.length} · {step.label}
              </span>
              <p className="text-xl leading-relaxed text-foreground/90">
                {step.prompt}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Textarea */}
        <textarea
          value={currentValue}
          onChange={(e) =>
            setContent({ ...content, [step.key]: e.target.value })
          }
          placeholder="在这里写下你的想法..."
          className="relative z-10 w-full h-32 resize-none rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-foreground placeholder:text-muted/50 focus:outline-none focus:border-glow-gold/50 transition-colors"
        />

        {/* Follow-up prompt */}
        <AnimatePresence>
          {showFollowUp && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex items-start gap-2 text-glow-gold/80 text-sm"
            >
              <Sparkles className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{step.followUp}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="flex items-center gap-1 text-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
          <span>上一步</span>
        </button>

        {currentIndex < STEPS.length - 1 ? (
          <button
            onClick={handleNext}
            className="flex items-center gap-1 text-muted hover:text-foreground transition-colors"
          >
            <span>下一步</span>
            <ChevronRight className="h-5 w-5" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            className="px-6 py-2.5 rounded-full bg-glow-gold text-midnight font-semibold hover:bg-glow-gold/90 transition-colors"
          >
            开启对话
          </button>
        )}
      </div>
    </div>
  );
}
