"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X, RotateCcw, Link2 } from "lucide-react";
import { format } from "date-fns";
import type { ReportRow } from "@/lib/narrative-report-service";

interface ReportDetailViewProps {
  report: ReportRow;
  onClose: () => void;
  onRegenerate?: (report: ReportRow) => void;
  onShare?: (report: ReportRow) => void;
  readOnly?: boolean;
}

const sectionVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: i * 0.1, ease: "easeOut" as const },
  }),
};

export function ReportDetailView({
  report,
  onClose,
  onRegenerate,
  onShare,
  readOnly = false,
}: ReportDetailViewProps) {
  const { content } = report;
  const startStr = format(new Date(report.start_date + "T00:00:00"), "M月d日");
  const endStr = format(new Date(report.end_date + "T00:00:00"), "M月d日");
  const [shareToast, setShareToast] = useState(false);

  const handleShare = () => {
    onShare?.(report);
    setShareToast(true);
    setTimeout(() => setShareToast(false), 3000);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-midnight/98 overflow-y-auto"
    >
      {/* Header bar - pt-[env(safe-area-inset-top)] for notch/dynamic island avoidance */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top,0.75rem))] pb-3 bg-midnight/80 backdrop-blur-md border-b border-white/5">
        <span className="text-xs text-muted/50">
          {startStr} ~ {endStr}
        </span>
        <div className="flex items-center gap-1">
          {!readOnly && onShare && (
            <button
              onClick={handleShare}
              className="h-10 w-10 flex items-center justify-center rounded-full text-muted/50 hover:text-glow-gold hover:bg-white/10 transition-colors"
              title="分享报告"
            >
              <Link2 className="h-4 w-4" />
            </button>
          )}
          {!readOnly && onRegenerate && (
            <button
              onClick={() => onRegenerate(report)}
              className="h-10 w-10 flex items-center justify-center rounded-full text-muted/50 hover:text-glow-gold hover:bg-white/10 transition-colors"
              title="重新生成"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="h-10 w-10 flex items-center justify-center rounded-full text-muted/50 hover:text-foreground hover:bg-white/10 transition-colors"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>

      {/* Share toast */}
      {shareToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-60 px-5 py-2.5 rounded-full bg-glow-gold/10 border border-glow-gold/20 text-sm text-glow-gold text-center whitespace-nowrap">
          公开分享链接已复制，去分享给懂你的人吧
        </div>
      )}

      {/* Content */}
      <div className="max-w-lg mx-auto px-5 py-8 space-y-10">
        {/* Theme + Transition */}
        <motion.section
          custom={0}
          initial="hidden"
          animate="visible"
          variants={sectionVariants}
          className="space-y-4"
        >
          <h1 className="text-2xl font-bold text-foreground/95 tracking-tight">
            {content.theme}
          </h1>
          <p className="text-sm text-foreground/70 leading-relaxed whitespace-pre-wrap">
            {content.transition}
          </p>
        </motion.section>

        {/* Timeline */}
        <motion.section
          custom={1}
          initial="hidden"
          animate="visible"
          variants={sectionVariants}
          className="space-y-4"
        >
          <h2 className="text-xs font-medium text-glow-gold/80 uppercase tracking-widest">
            时光轨迹
          </h2>
          <div className="relative pl-5 border-l border-glow-gold/20 space-y-6">
            {content.timeline.map((item, i) => (
              <motion.div
                key={i}
                custom={2 + i}
                initial="hidden"
                animate="visible"
                variants={sectionVariants}
              >
                <div className="absolute -left-[5px] w-2.5 h-2.5 rounded-full bg-glow-gold/40 border border-glow-gold/60" />
                <p className="text-xs text-glow-gold/60 mb-1">{item.period}</p>
                <p className="text-sm text-foreground/70 leading-relaxed">
                  {item.description}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Dimensions */}
        <motion.section
          custom={3}
          initial="hidden"
          animate="visible"
          variants={sectionVariants}
          className="space-y-4"
        >
          <h2 className="text-xs font-medium text-glow-gold/80 uppercase tracking-widest">
            能量转移
          </h2>
          <div className="space-y-4">
            {content.dimensions.map((dim, i) => (
              <motion.div
                key={i}
                custom={4 + i}
                initial="hidden"
                animate="visible"
                variants={sectionVariants}
                className="rounded-xl border border-white/8 bg-white/[0.02] p-4 space-y-3"
              >
                <h3 className="text-sm font-medium text-foreground/85">
                  {dim.module}
                </h3>
                <div className="space-y-2">
                  <div>
                    <span className="text-[10px] text-muted/40 uppercase tracking-wider">
                      前期
                    </span>
                    <p className="text-xs text-foreground/60 leading-relaxed mt-0.5">
                      {dim.prev_state}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 py-1">
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-glow-gold/20 to-transparent" />
                    <span className="text-[10px] text-glow-gold/40">→</span>
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-glow-gold/20 to-transparent" />
                  </div>
                  <div>
                    <span className="text-[10px] text-muted/40 uppercase tracking-wider">
                      位移
                    </span>
                    <p className="text-xs text-foreground/60 leading-relaxed mt-0.5">
                      {dim.current_shift}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Key Events */}
        <motion.section
          custom={5}
          initial="hidden"
          animate="visible"
          variants={sectionVariants}
          className="space-y-4 pb-12"
        >
          <h2 className="text-xs font-medium text-glow-gold/80 uppercase tracking-widest">
            心境触点
          </h2>
          <div className="space-y-4">
            {content.events.map((ev, i) => (
              <motion.div
                key={i}
                custom={6 + i}
                initial="hidden"
                animate="visible"
                variants={sectionVariants}
                className="rounded-xl border border-white/8 bg-white/[0.02] p-4"
              >
                <h3 className="text-sm font-medium text-foreground/85 mb-2">
                  {ev.event}
                </h3>
                <p className="text-xs text-foreground/60 leading-relaxed">
                  {ev.impact}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.section>
      </div>
    </motion.div>
  );
}
