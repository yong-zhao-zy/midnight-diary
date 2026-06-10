"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X, RotateCcw, Share2 } from "lucide-react";
import { format } from "date-fns";
import Markdown from "react-markdown";
import type { ReportRow } from "@/lib/narrative-report-service";
import { toggleReportShareStatus } from "@/lib/narrative-report-service";

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

/**
 * Renders markdown text with highlighted bold styling.
 * Bold text (**...**) renders as gold-colored, slightly larger, with glow.
 */
function HighlightedText({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  return (
    <Markdown
      components={{
        p: ({ children }) => (
          <p className={`mb-4 last:mb-0 ${className}`}>{children}</p>
        ),
        strong: ({ children }) => (
          <strong className="text-amber-200 font-semibold text-[15px] [text-shadow:0_0_8px_rgba(253,230,138,0.2)]">
            {children}
          </strong>
        ),
      }}
    >
      {text}
    </Markdown>
  );
}

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
  const [toastMsg, setToastMsg] = useState("");

  // Support both old (string) and new (object) transition format
  const transitionTitle =
    typeof content.transition === "object"
      ? content.transition.title
      : null;
  const transitionText =
    typeof content.transition === "object"
      ? content.transition.description
      : content.transition;

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setShareToast(true);
    setTimeout(() => setShareToast(false), 3000);
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/share/report/${report.id}`;
    const shareTitle = report.content.theme || "我的深夜成长报告";
    const shareText =
      "这是我在【深空回响】生成的深夜心灵成长报告，分享给你。";

    try {
      // 1. 静默更新数据库分享状态
      toggleReportShareStatus(report.id, true).catch((err) => {
        console.error("更新分享状态失败:", err);
      });

      // 2. 优先尝试系统原生分享
      if (navigator.share) {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        onShare?.(report);
        return;
      }

      // 3. Fallback: 复制链接到剪贴板
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareUrl);
        showToast("公开分享链接已复制，去分享给懂你的人吧");
        onShare?.(report);
        return;
      }

      // 4. 终极兜底：textarea execCommand
      const textarea = document.createElement("textarea");
      textarea.value = shareUrl;
      textarea.style.position = "fixed";
      textarea.style.top = "0";
      textarea.style.left = "0";
      textarea.style.width = "2em";
      textarea.style.height = "2em";
      textarea.style.background = "transparent";
      textarea.style.border = "none";
      textarea.style.outline = "none";

      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, 99999);

      const success = document.execCommand("copy");
      document.body.removeChild(textarea);

      if (success) {
        showToast("公开分享链接已复制，去分享给懂你的人吧");
        onShare?.(report);
      } else {
        throw new Error("Copy failed");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      console.error("分享失败:", error);
      alert(`请手动复制分享链接：\n${shareUrl}`);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-midnight/98 overflow-y-auto"
    >
      {/* Header bar - safe area for notch/dynamic island */}
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
              <Share2 className="h-4 w-4" />
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
          {toastMsg}
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
          {transitionTitle && (
            <p className="text-sm font-medium text-glow-gold/70">
              {transitionTitle}
            </p>
          )}
          <div className="text-sm text-foreground/70 leading-relaxed">
            <HighlightedText
              text={transitionText}
              className="text-sm text-foreground/70 leading-relaxed"
            />
          </div>
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
                <p className="text-xs text-glow-gold/60 mb-2">{item.period}</p>
                <div className="text-sm text-foreground/70 leading-relaxed">
                  <HighlightedText
                    text={item.description}
                    className="text-sm text-foreground/70 leading-relaxed"
                  />
                </div>
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
                    <div className="mt-0.5">
                      <HighlightedText
                        text={dim.prev_state}
                        className="text-xs text-foreground/60 leading-relaxed"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 py-1">
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-glow-gold/20 to-transparent" />
                    <span className="text-[10px] text-glow-gold/40">→</span>
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-glow-gold/20 to-transparent" />
                  </div>
                  <div>
                    <span className="text-[10px] text-muted/40 uppercase tracking-wider">
                      转变
                    </span>
                    <div className="mt-0.5">
                      <HighlightedText
                        text={dim.current_shift}
                        className="text-xs text-foreground/60 leading-relaxed"
                      />
                    </div>
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
                <div>
                  <HighlightedText
                    text={ev.impact}
                    className="text-xs text-foreground/60 leading-relaxed"
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>
      </div>
    </motion.div>
  );
}
