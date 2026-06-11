"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X, Check, Sparkles, Loader2 } from "lucide-react";
import {
  OFFICIAL_EXPERTS,
  CUSTOM_TAGS_CONFIG,
  type CustomExpertTags,
} from "@/config/experts-config";
import { updateExpertStyle } from "@/lib/profile-service";

interface ExpertSettingsProps {
  currentStyle: string;
  currentTags: CustomExpertTags | null;
  onSave: (style: string, tags: CustomExpertTags | null) => void;
  onClose: () => void;
}

export function ExpertSettings({
  currentStyle,
  currentTags,
  onSave,
  onClose,
}: ExpertSettingsProps) {
  const [selected, setSelected] = useState(currentStyle);
  const [showCustom, setShowCustom] = useState(currentStyle === "custom");
  const [customTone, setCustomTone] = useState<string | undefined>(
    currentTags?.tone
  );
  const [customFocus, setCustomFocus] = useState<string[]>(
    currentTags?.focus ?? []
  );
  const [customEnding, setCustomEnding] = useState<string | undefined>(
    currentTags?.ending
  );
  const [saving, setSaving] = useState(false);

  const handleSelectOfficial = async (id: string) => {
    setSelected(id);
    setShowCustom(false);
    setSaving(true);
    await updateExpertStyle(id);
    setSaving(false);
    onSave(id, null);
  };

  const handleToggleFocus = (tag: string) => {
    setCustomFocus((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag);
      if (prev.length >= 2) return prev;
      return [...prev, tag];
    });
  };

  const handleSaveCustom = async () => {
    const tags: CustomExpertTags = {
      tone: customTone,
      focus: customFocus.length > 0 ? customFocus : undefined,
      ending: customEnding,
    };
    setSaving(true);
    await updateExpertStyle("custom", tags);
    setSaving(false);
    onSave("custom", tags);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-midnight/98 overflow-y-auto"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top,0.75rem))] pb-3 bg-midnight/80 backdrop-blur-md border-b border-white/5">
        <h2 className="text-sm font-medium text-foreground/90">
          选择你的 AI 心理顾问
        </h2>
        <button
          onClick={onClose}
          className="h-10 w-10 flex items-center justify-center rounded-full text-muted/50 hover:text-foreground hover:bg-white/10 transition-colors"
        >
          <X className="h-4.5 w-4.5" />
        </button>
      </div>

      <div className="max-w-lg mx-auto px-5 py-6 space-y-4">
        {/* Official experts */}
        {OFFICIAL_EXPERTS.map((expert) => (
          <button
            key={expert.id}
            onClick={() => handleSelectOfficial(expert.id)}
            disabled={saving}
            className={`w-full text-left p-4 rounded-2xl border transition-all ${
              selected === expert.id && !showCustom
                ? "border-glow-gold/60 bg-glow-gold/[0.04]"
                : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-foreground/90">
                    {expert.name}
                  </h3>
                  <span className="text-[10px] text-muted/50 px-1.5 py-0.5 rounded-full border border-white/8">
                    {expert.role}
                  </span>
                </div>
                <p className="text-xs text-muted/60">{expert.focus}</p>
                <p className="text-xs text-foreground/40 italic mt-2 leading-relaxed">
                  {expert.example}
                </p>
              </div>
              {selected === expert.id && !showCustom && (
                <Check className="h-4 w-4 text-glow-gold shrink-0 mt-0.5" />
              )}
            </div>
          </button>
        ))}

        {/* Custom entry */}
        <div className="pt-4 border-t border-white/8">
          {!showCustom ? (
            <button
              onClick={() => {
                setShowCustom(true);
                setSelected("custom");
              }}
              className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl border border-dashed border-white/15 text-sm text-muted/60 hover:text-glow-gold hover:border-glow-gold/30 transition-all"
            >
              <Sparkles className="h-4 w-4" />
              以上都不要，定制专属陪伴者（手捏）
            </button>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-glow-gold/40 bg-glow-gold/[0.03] p-5 space-y-5"
            >
              <h3 className="text-sm font-medium text-glow-gold/90">
                手捏你的专属顾问
              </h3>

              {/* Tone - single select */}
              <div className="space-y-2">
                <p className="text-xs text-muted/50">语气（单选）</p>
                <div className="flex flex-wrap gap-2">
                  {CUSTOM_TAGS_CONFIG.tone.map((tag) => (
                    <button
                      key={tag}
                      onClick={() =>
                        setCustomTone(customTone === tag ? undefined : tag)
                      }
                      className={`px-3 py-1.5 rounded-full text-xs transition-all ${
                        customTone === tag
                          ? "bg-glow-gold/20 text-glow-gold border border-glow-gold/40"
                          : "bg-white/[0.04] text-muted/60 border border-white/10 hover:border-white/20"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Focus - max 2 */}
              <div className="space-y-2">
                <p className="text-xs text-muted/50">焦点（最多选 2 个）</p>
                <div className="flex flex-wrap gap-2">
                  {CUSTOM_TAGS_CONFIG.focus.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => handleToggleFocus(tag)}
                      className={`px-3 py-1.5 rounded-full text-xs transition-all ${
                        customFocus.includes(tag)
                          ? "bg-glow-gold/20 text-glow-gold border border-glow-gold/40"
                          : "bg-white/[0.04] text-muted/60 border border-white/10 hover:border-white/20"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
                {customFocus.length >= 2 && (
                  <p className="text-[10px] text-amber-400/60">
                    已达上限，取消已选后可选择其他
                  </p>
                )}
              </div>

              {/* Ending - single select */}
              <div className="space-y-2">
                <p className="text-xs text-muted/50">结尾风格（单选）</p>
                <div className="flex flex-wrap gap-2">
                  {CUSTOM_TAGS_CONFIG.ending.map((tag) => (
                    <button
                      key={tag}
                      onClick={() =>
                        setCustomEnding(customEnding === tag ? undefined : tag)
                      }
                      className={`px-3 py-1.5 rounded-full text-xs transition-all ${
                        customEnding === tag
                          ? "bg-glow-gold/20 text-glow-gold border border-glow-gold/40"
                          : "bg-white/[0.04] text-muted/60 border border-white/10 hover:border-white/20"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Save button */}
              <button
                onClick={handleSaveCustom}
                disabled={saving || (!customTone && customFocus.length === 0 && !customEnding)}
                className="w-full flex items-center justify-center gap-2 h-11 rounded-2xl bg-glow-gold text-midnight text-sm font-medium disabled:opacity-40 hover:bg-glow-gold/90 active:scale-[0.98] transition-all"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                保存并启用
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
