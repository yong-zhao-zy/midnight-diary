"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

const INTRO_KEY = "has_seen_v2_intro";

interface Scene {
  title: string;
  body: string;
  footnote: string;
  bg: string; // tailwind gradient
}

const SCENES: Scene[] = [
  {
    title: "在记录中看见自己的成长",
    body: "在这里，我们将通过 4 个科学维度，陪你完成一次次自我对话与成长。",
    footnote: "日记模块设置基于认知行为疗法(CBT)与积极心理学模型构建。",
    bg: "from-[#0a1628] via-[#0f172a] to-[#1a1040]",
  },
  {
    title: "01 身心觉知",
    body: "感受情绪流动，捕捉身体信号。",
    footnote: "科学依据：准确描述情绪与感知躯体信号，能降低杏仁核的过度活跃，减少焦虑。",
    bg: "from-[#0a1628] via-[#112240] to-[#0f172a]",
  },
  {
    title: "02 人际链接",
    body: "在与他人的碰撞中，照见真实的自己。",
    footnote: "科学依据：依恋理论指出，健康的社交链接能分泌催产素，平衡神经系统，提升抗压韧性。",
    bg: "from-[#112240] via-[#1a1040] to-[#1e293b]",
  },
  {
    title: "03 深度体验",
    body: "记录那些震动灵魂的时刻。无论是狂喜、触动，还是忘我的投入。",
    footnote: "科学依据：诚实记录高强度体验（无论极性），能为生命建立稳固的心理锚点。",
    bg: "from-[#1a1040] via-[#1e1a3a] to-[#0f172a]",
  },
  {
    title: "04 感恩与愿景",
    body: "记录来自他人或自我的感恩，或种下明天的期许。",
    footnote: "科学依据：感恩能重构神经可塑性；建立积极的未来预期（希望理论）是心理自愈的终点。",
    bg: "from-[#1e1a3a] via-[#1a2744] to-[#2d1f0f]",
  },
  {
    title: "请跟我一起，把记录化作治愈的力量吧～",
    body: "",
    footnote: "",
    bg: "from-[#0f172a] via-[#1a1040] to-[#0a1628]",
  },
];

function getAutoDelay(scene: Scene): number {
  const textLen = scene.title.length + scene.body.length + scene.footnote.length;
  return Math.max(5, textLen / 4) * 1000;
}

// ─── Visual layers per scene ───

function SceneVisual({ index }: { index: number }) {
  if (index === 0) {
    // Expanding ripple
    return (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border border-glow-gold/20"
            initial={{ width: 40, height: 40, opacity: 0.8 }}
            animate={{
              width: [40, 300],
              height: [40, 300],
              opacity: [0.6, 0],
            }}
            transition={{
              duration: 3,
              delay: i * 0.8,
              repeat: Infinity,
              ease: "easeOut",
            }}
          />
        ))}
      </div>
    );
  }

  if (index === 1) {
    // Gentle blue undulating surface (represented as layered waves)
    return (
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute bottom-1/3 left-0 right-0 h-32 rounded-[50%] bg-blue-500/8"
            animate={{ y: [0, -12, 0], scaleX: [1, 1.02, 1] }}
            transition={{
              duration: 4 + i,
              delay: i * 0.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            style={{ bottom: `${30 + i * 6}%` }}
          />
        ))}
      </div>
    );
  }

  if (index === 2) {
    // Golden flowing lines
    return (
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[0, 1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="absolute h-px bg-gradient-to-r from-transparent via-glow-gold/40 to-transparent"
            style={{
              top: `${35 + i * 8}%`,
              left: "-20%",
              right: "-20%",
            }}
            animate={{ x: ["-10%", "10%", "-10%"], opacity: [0.3, 0.7, 0.3] }}
            transition={{
              duration: 5 + i,
              delay: i * 0.6,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
    );
  }

  if (index === 3) {
    // Star dust with pulse
    return (
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-glow-gold/60"
            style={{
              top: `${20 + Math.random() * 60}%`,
              left: `${10 + Math.random() * 80}%`,
            }}
            animate={{
              opacity: [0, 0.8, 0],
              scale: [0.5, 1.2, 0.5],
            }}
            transition={{
              duration: 2 + Math.random() * 2,
              delay: Math.random() * 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
    );
  }

  if (index === 4) {
    // Dawn horizon gradient rising
    return (
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-amber-900/20 via-amber-700/10 to-transparent"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 2, ease: "easeOut" }}
        />
        <motion.div
          className="absolute bottom-[28%] left-1/2 -translate-x-1/2 w-[120%] h-px bg-gradient-to-r from-transparent via-amber-400/30 to-transparent"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
    );
  }

  // Scene 5: converging breath button (handled in text area)
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <motion.div
        className="w-32 h-32 rounded-full bg-glow-gold/10 blur-2xl"
        animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

// ─── Main component ───

interface IntroOverlayProps {
  onComplete: () => void;
}

export function IntroOverlay({ onComplete }: IntroOverlayProps) {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const scene = SCENES[current];
  const isLast = current === SCENES.length - 1;

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(INTRO_KEY, "1");
    } catch {}
    onComplete();
  }, [onComplete]);

  const goTo = useCallback(
    (next: number) => {
      if (next < 0 || next >= SCENES.length) return;
      setCurrent(next);
    },
    []
  );

  // Auto-advance timer
  useEffect(() => {
    if (isLast) return; // Don't auto-advance on CTA

    const delay = getAutoDelay(SCENES[current]);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setCurrent((prev) => Math.min(prev + 1, SCENES.length - 1));
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [current, isLast]);

  // Progress bar animation
  useEffect(() => {
    if (!progressRef.current) return;
    const el = progressRef.current;

    if (isLast) {
      el.style.transition = "none";
      el.style.width = "100%";
      return;
    }

    const delay = getAutoDelay(SCENES[current]);
    el.style.transition = "none";
    el.style.width = `${(current / SCENES.length) * 100}%`;

    requestAnimationFrame(() => {
      el.style.transition = `width ${delay}ms linear`;
      el.style.width = `${((current + 1) / SCENES.length) * 100}%`;
    });
  }, [current, isLast]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 z-[100] flex flex-col overflow-hidden"
    >
      {/* Background gradient */}
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className={`absolute inset-0 bg-gradient-to-b ${scene.bg}`}
        />
      </AnimatePresence>

      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-white/5 z-10">
        <div
          ref={progressRef}
          className="h-full bg-glow-gold/60"
        />
      </div>

      {/* Skip button */}
      {!isLast && (
        <button
          onClick={dismiss}
          className="absolute top-[env(safe-area-inset-top,12px)] right-4 mt-3 z-10 flex items-center gap-1 text-xs text-muted/60 hover:text-foreground transition-colors px-2 py-1"
        >
          跳过 <X className="h-3 w-3" />
        </button>
      )}

      {/* Visual layer */}
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="absolute inset-0"
        >
          <SceneVisual index={current} />
        </motion.div>
      </AnimatePresence>

      {/* Content */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-8 text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="max-w-sm space-y-5"
          >
            <h2 className="text-2xl font-semibold text-glow-gold leading-relaxed">
              {scene.title}
            </h2>

            {scene.body && (
              <p className="text-foreground/80 leading-relaxed">
                {scene.body}
              </p>
            )}

            {scene.footnote && (
              <p className="text-xs text-muted/60 leading-relaxed">
                {scene.footnote}
              </p>
            )}

            {/* CTA button on last scene */}
            {isLast && (
              <motion.button
                onClick={dismiss}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: [1, 1.03, 1], opacity: 1 }}
                transition={{
                  scale: { duration: 2, repeat: Infinity, ease: "easeInOut" },
                  opacity: { duration: 0.5 },
                }}
                className="mt-8 px-8 py-3 rounded-full bg-glow-gold text-midnight font-semibold text-base shadow-lg shadow-glow-gold/20 hover:bg-glow-gold/90 active:scale-95 transition-transform"
              >
                开启今晚的记录
              </motion.button>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      {!isLast && (
        <div className="relative z-10 flex items-center justify-between px-8 pb-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
          <button
            onClick={() => goTo(current - 1)}
            disabled={current === 0}
            className="flex items-center gap-1 text-sm text-muted/60 hover:text-foreground disabled:opacity-0 transition-all"
          >
            <ChevronLeft className="h-4 w-4" />
            上一页
          </button>
          <button
            onClick={() => goTo(current + 1)}
            className="flex items-center gap-1 text-sm text-muted/60 hover:text-foreground transition-colors"
          >
            下一页
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </motion.div>
  );
}

// ─── Hook: check if intro should show ───

export function useShowIntro(diaryCount: number): boolean {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (diaryCount > 0) return;
    try {
      const seen = localStorage.getItem(INTRO_KEY);
      if (!seen) setShow(true);
    } catch {}
  }, [diaryCount]);

  return show;
}
