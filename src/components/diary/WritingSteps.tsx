"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { saveDiaryToCloud } from "@/lib/diary-service";

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

export function WritingSteps() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [content, setContent] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);

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

  const handleSubmit = async () => {
    setLoading(true);

    try {
      // 1. Call AI
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      const message = data.message || "今晚的回信未能送达。";

      setAiResponse(message);

      // 2. Save to Supabase after receiving AI response
      await saveDiaryToCloud(content, message);
    } catch {
      setAiResponse("连接失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  };

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

  if (aiResponse) {
    return (
      <div className="max-w-xl mx-auto space-y-6 py-10">
        <h2 className="text-2xl font-semibold text-glow-gold">来自深夜的回信</h2>
        <p className="text-foreground/90 leading-relaxed whitespace-pre-wrap">
          {aiResponse}
        </p>
        <div className="flex gap-4">
          <button
            onClick={() => {
              setAiResponse(null);
              setContent({});
              setCurrentIndex(0);
            }}
            className="text-muted underline underline-offset-4 hover:text-glow-gold transition-colors"
          >
            再写一篇
          </button>
          <button
            onClick={() => router.push("/")}
            className="text-muted underline underline-offset-4 hover:text-glow-gold transition-colors"
          >
            回到首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto w-full space-y-8">
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
                : "w-2 bg-foreground/20"
            )}
          />
        ))}
      </div>

      {/* Step Content */}
      <div className="space-y-5">
        {/* Animated prompt area */}
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
          onClick={() => goTo(currentIndex - 1)}
          disabled={currentIndex === 0}
          className="flex items-center gap-1 text-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
          <span>上一步</span>
        </button>

        {currentIndex < STEPS.length - 1 ? (
          <button
            onClick={() => goTo(currentIndex + 1)}
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
