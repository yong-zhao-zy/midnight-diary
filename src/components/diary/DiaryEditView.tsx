"use client";

import { useState } from "react";
import { Loader2, Check } from "lucide-react";
import { updateDiaryContent, type DiaryContent } from "@/lib/diary-service";
import { VoiceTextInput } from "@/components/VoiceTextInput";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
  DEFAULT_MODULE_CONFIG,
  getActiveModules,
  migrateLegacyContent,
  type ModuleConfig,
} from "@/lib/module-config";


interface DiaryEditViewProps {
  diaryId: string;
  initialContent: DiaryContent;
  onSaved: (content: DiaryContent) => void;
  onCancel: () => void;
  moduleConfig?: ModuleConfig[];
}

export function DiaryEditView({
  diaryId,
  initialContent,
  onSaved,
  onCancel,
  moduleConfig: externalConfig,
}: DiaryEditViewProps) {
  const moduleConfig = externalConfig || DEFAULT_MODULE_CONFIG;
  const activeModules = getActiveModules(moduleConfig);

  const [content, setContent] = useState<Record<string, string>>(() => {
    // Migrate legacy keys (mind_body → m1, etc.) if needed
    const raw = initialContent as Record<string, string>;
    const migrated = migrateLegacyContent(raw);
    const full: Record<string, string> = {};
    for (const m of activeModules) {
      full[m.id] = migrated[m.id] || "";
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
        body: JSON.stringify({ diaryId, content, moduleConfig: activeModules }),
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

      {activeModules.map((mod) => (
        <Card key={mod.id} className="rounded-2xl shadow-sm border-white/8 bg-white/[0.02]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-glow-gold/80">
              {mod.label}
            </CardTitle>
            <CardDescription className="text-xs text-muted/50">
              {mod.prompt}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VoiceTextInput
              value={content[mod.id]}
              onChange={(val) => setContent({ ...content, [mod.id]: val })}
              placeholder={mod.prompt}
              className="min-h-[100px] text-sm leading-relaxed placeholder:text-muted/30 border-white/10 bg-transparent focus:border-glow-gold/30 focus:ring-glow-gold/20"
            />
          </CardContent>
        </Card>
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
