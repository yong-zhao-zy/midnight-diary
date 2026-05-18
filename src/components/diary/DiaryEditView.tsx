"use client";

import { useState } from "react";
import { Loader2, Check } from "lucide-react";
import { updateDiaryContent } from "@/lib/diary-service";

interface DiaryEditViewProps {
  diaryId: string;
  initialContent: Record<string, string>;
  onSaved: (content: Record<string, string>) => void;
  onCancel: () => void;
}

const MODULES = [
  { key: "emotion", label: "情绪", prompt: "此刻你的内心是什么颜色？" },
  { key: "body", label: "身体", prompt: "你的身体哪个部位最紧绷？" },
  { key: "social", label: "人际", prompt: "今天有谁浮现在你脑海？" },
  { key: "light", label: "微光", prompt: "有没有让你嘴角上扬的瞬间？" },
  { key: "challenge", label: "挑战", prompt: "明天想做一件什么小事？" },
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
    const filtered = Object.fromEntries(
      Object.entries(content).filter(([, v]) => v.trim())
    );
    const ok = await updateDiaryContent(diaryId, filtered);
    setSaving(false);
    if (ok) {
      onSaved(filtered);
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
          <textarea
            value={content[mod.key]}
            onChange={(e) =>
              setContent({ ...content, [mod.key]: e.target.value })
            }
            placeholder={mod.prompt}
            className="w-full min-h-[100px] resize-none rounded-xl bg-white/[0.04] border border-white/10 px-4 py-3 text-sm text-foreground leading-relaxed placeholder:text-muted/30 focus:outline-none focus:border-glow-gold/40 transition-colors"
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
