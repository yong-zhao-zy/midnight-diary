"use client";

import { useState } from "react";
import { Loader2, Check } from "lucide-react";
import { updateDiaryContent, type DiaryContent } from "@/lib/diary-service";
import { VoiceTextInput } from "@/components/VoiceTextInput";

interface DiaryEditViewProps {
  diaryId: string;
  initialContent: DiaryContent;
  onSaved: (content: DiaryContent) => void;
  onCancel: () => void;
}

const MODULES = [
  { key: "mind_body", label: "身心觉知", prompt: "此刻你的内心和身体在告诉你什么？" },
  { key: "connection", label: "人际链接", prompt: "今天有谁浮现在你脑海？" },
  { key: "peak_moment", label: "高光瞬间", prompt: "有没有让你心头一亮的瞬间？" },
  { key: "vision", label: "感恩与愿景", prompt: "你最想感谢什么？明天想做什么小事？" },
];

export function DiaryEditView({
  diaryId,
  initialContent,
  onSaved,
  onCancel,
}: DiaryEditViewProps) {
  const [content, setContent] = useState<Record<string, string>>(() => {
    const full: Record<string, string> = {};
    for (const m of MODULES) {
      full[m.key] = initialContent[m.key] || "";
    }
    return full;
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const ok = await updateDiaryContent(diaryId, content);
    setSaving(false);
    if (ok) {
      // Async summary regeneration (non-blocking)
      fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diaryId, content }),
      }).catch(() => {});
      onSaved(content as DiaryContent);
    }
  };

  return (
    <div className="space-y-8 py-2">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-glow-gold">编辑日记</h3>
        <p className="text-xs text-muted">修改任意模块，留空的部分不会被保存</p>
      </div>

      {MODULES.map((mod) => (
        <div key={mod.key} className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium text-glow-gold/80">
              {mod.label}
            </span>
            <span className="text-xs text-muted/50">{mod.prompt}</span>
          </div>
          <VoiceTextInput
            value={content[mod.key]}
            onChange={(val) => setContent({ ...content, [mod.key]: val })}
            placeholder={mod.prompt}
            className="min-h-[100px] text-sm leading-relaxed placeholder:text-muted/30 bg-white/[0.04] focus:border-glow-gold/40"
          />
        </div>
      ))}

      <div className="flex items-center gap-4 pt-2 pb-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-glow-gold text-midnight text-sm font-semibold disabled:opacity-50 hover:bg-glow-gold/90 active:scale-95 transition-all"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          保存修改
        </button>
        <button
          onClick={onCancel}
          className="text-sm text-muted hover:text-foreground transition-colors"
        >
          取消
        </button>
      </div>
    </div>
  );
}
