"use client";

import { useMemo, useState } from "react";
import { Loader2, Check, CloudOff } from "lucide-react";
import { updateDiaryContent, type DiaryContent } from "@/lib/diary-service";
import { useDiaryAutoSave } from "@/hooks/use-diary-autosave";
import { VoiceTextInput } from "@/components/VoiceTextInput";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
  DEFAULT_MODULE_CONFIG,
  getActiveModules,
  migrateLegacyContent,
  getPrefixedLabel,
  buildLabelsSnapshot,
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
  const [canceling, setCanceling] = useState(false);

  const labelsSnapshot = useMemo(
    () => buildLabelsSnapshot(moduleConfig),
    [moduleConfig]
  );

  const { status: autoSaveStatus, flush } = useDiaryAutoSave({
    diaryId,
    content,
    labelsSnapshot,
  });

  const handleSave = async () => {
    setSaving(true);
    // Flush pending autosave first to ensure latest content is persisted
    await flush();
    // Then do the explicit save (which also triggers summary regen)
    const ok = await updateDiaryContent(diaryId, content, labelsSnapshot);
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

  const handleCancelClick = async () => {
    if (canceling) return;
    setCanceling(true);
    // Flush pending changes before navigating away — never silently drop edits
    await flush();
    onCancel();
  };

  return (
    <div className="space-y-8 py-2">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-accent">编辑日记</h3>
        <p className="text-xs text-ink-2">修改任意模块，留空的部分不会被保存</p>
      </div>

      {/* Auto-save status indicator */}
      <div className="flex items-center gap-1.5 min-h-[18px] text-xs">
        {autoSaveStatus === "saving" && (
          <>
            <Loader2 className="h-3 w-3 animate-spin text-ink-2/70" />
            <span className="text-ink-2/70">正在保存…</span>
          </>
        )}
        {autoSaveStatus === "saved" && (
          <>
            <Check className="h-3 w-3 text-accent/70" />
            <span className="text-ink-2/70">已自动保存</span>
          </>
        )}
        {autoSaveStatus === "error" && (
          <>
            <CloudOff className="h-3 w-3 text-red-400/80" />
            <span className="text-red-400/80">保存失败，请检查网络</span>
          </>
        )}
      </div>

      {activeModules.map((mod, idx) => (
        <Card key={mod.id} className="rounded-2xl shadow-sm border-line-2 bg-surface-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-accent/80">
              {getPrefixedLabel(mod.label, idx)}
            </CardTitle>
            <CardDescription className="text-xs text-ink-2/60">
              {mod.prompt}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VoiceTextInput
              value={content[mod.id]}
              onChange={(val) => {
                console.log("[DiaryEditView] onChange", {
                  modId: mod.id,
                  valLength: val.length,
                  valPreview: val.slice(0, 20),
                });
                setContent({ ...content, [mod.id]: val });
              }}
              placeholder={mod.prompt}
              className="min-h-[100px] text-sm leading-relaxed placeholder:text-ink-2/40 border-line-2 bg-transparent focus:border-accent/30 focus:ring-accent/20"
            />
          </CardContent>
        </Card>
      ))}

      <div className="flex items-center gap-4 pt-2 pb-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-accent text-accent-ink text-sm font-semibold disabled:opacity-50 hover:bg-accent/90 active:scale-95 transition-all"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          保存修改
        </button>
        <button
          onClick={handleCancelClick}
          disabled={canceling}
          className="flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink transition-colors disabled:opacity-50"
        >
          {canceling && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          取消
        </button>
      </div>
    </div>
  );
}
