"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, SlidersHorizontal } from "lucide-react";

const PROMPT_OPTIONS = [
  {
    type: "guide",
    icon: "🧠",
    label: "引导词生成",
    desc: "日记撰写前的动态提问",
  },
  {
    type: "analysis",
    icon: "🧪",
    label: "AI日记分析",
    desc: "每日深度解读回响信件",
  },
  {
    type: "summary",
    icon: "📝",
    label: "AI日记摘要",
    desc: "列表骨架化情绪提炼",
  },
  {
    type: "report",
    icon: "📊",
    label: "AI日记报告",
    desc: "阶段性成长叙事报告",
  },
] as const;

export function PromptLabCard() {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-center gap-2 mb-4">
        <SlidersHorizontal className="h-4 w-4 text-glow-gold/70" />
        <h2 className="text-sm font-medium text-foreground/90">
          提示词实验坊
        </h2>
      </div>

      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between p-4 rounded-xl border border-white/8 bg-white/[0.02] hover:border-glow-gold/30 hover:bg-white/[0.04] transition-all group"
      >
        <div className="flex items-center gap-3 text-left">
          <span className="text-lg">📁</span>
          <div>
            <p className="text-sm font-medium text-foreground/85">
              Prompt Lab
            </p>
            <p className="text-xs text-muted/50 mt-0.5">
              自定义 4 大 AI 接口的提示词模板
            </p>
          </div>
        </div>
        <motion.div
          animate={{ rotate: expanded ? 90 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0"
        >
          <ChevronRight className="h-4 w-4 text-muted/40 group-hover:text-glow-gold/60 transition-colors" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-2">
              {PROMPT_OPTIONS.map((opt) => (
                <button
                  key={opt.type}
                  onClick={() => router.push(`/my/prompts?type=${opt.type}`)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-white/6 bg-white/[0.015] hover:border-glow-gold/25 hover:bg-white/[0.04] transition-all group"
                >
                  <span className="text-base">{opt.icon}</span>
                  <div className="text-left flex-1">
                    <p className="text-sm font-medium text-foreground/80">
                      {opt.label}
                    </p>
                    <p className="text-[11px] text-muted/45 mt-0.5">
                      {opt.desc}
                    </p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted/30 group-hover:text-glow-gold/50 transition-colors shrink-0" />
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
