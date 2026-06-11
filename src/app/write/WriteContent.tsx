"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { WritingSteps } from "@/components/diary/WritingSteps";
import { DiaryEditView } from "@/components/diary/DiaryEditView";
import { ModuleManagerSheet } from "@/components/diary/ModuleManagerSheet";
import { getDiaryById, type DiaryRow } from "@/lib/diary-service";
import { DEFAULT_MODULE_CONFIG, type ModuleConfig } from "@/lib/module-config";
import { createClient } from "@/lib/supabase/client";
import type { CustomExpertTags } from "@/config/experts-config";

export function WriteContent() {
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");

  const [diary, setDiary] = useState<DiaryRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [moduleConfig, setModuleConfig] = useState<ModuleConfig[]>(DEFAULT_MODULE_CONFIG);
  const [expertStyle, setExpertStyle] = useState("warm_companion");
  const [customExpertTags, setCustomExpertTags] = useState<CustomExpertTags | null>(null);

  // Load user's profile settings on mount
  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("module_config, expert_style, custom_expert_tags")
          .eq("id", user.id)
          .single();

        if (profile?.module_config && Array.isArray(profile.module_config)) {
          setModuleConfig(profile.module_config as ModuleConfig[]);
        }
        if (profile?.expert_style) {
          setExpertStyle(profile.expert_style as string);
        }
        if (profile?.custom_expert_tags) {
          setCustomExpertTags(profile.custom_expert_tags as CustomExpertTags);
        }
      }

      if (editId) {
        const d = await getDiaryById(editId);
        setDiary(d);
      }

      setLoading(false);
    }

    init();
  }, [editId]);

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-glow-gold" />
      </main>
    );
  }

  // Edit/Continue mode
  if (editId && diary) {
    return (
      <main className="flex flex-1 flex-col items-center px-6 py-12">
        <header className="mb-8 w-full max-w-xl flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold text-glow-gold">
              续写今日的心路
            </h1>
            <p className="text-muted text-sm">修改或补充你今天的记录</p>
          </div>
          <ModuleManagerSheet
            moduleConfig={moduleConfig}
            onConfigChange={setModuleConfig}
          />
        </header>

        <div className="w-full max-w-xl">
          {saved ? (
            <div className="text-center py-10 space-y-4">
              <p className="text-glow-gold text-lg">内容已更新</p>
              <div className="flex justify-center gap-4">
                <button
                  onClick={() => setSaved(false)}
                  className="text-sm text-muted underline underline-offset-4 hover:text-glow-gold transition-colors"
                >
                  继续编辑
                </button>
                <a
                  href="/"
                  className="text-sm text-muted underline underline-offset-4 hover:text-glow-gold transition-colors"
                >
                  回到首页
                </a>
              </div>
            </div>
          ) : (
            <DiaryEditView
              diaryId={diary.id}
              initialContent={diary.content}
              onSaved={() => setSaved(true)}
              onCancel={() => window.history.back()}
              moduleConfig={moduleConfig}
            />
          )}
        </div>
      </main>
    );
  }

  // First-time mode: step-by-step guided writing
  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <header className="mb-10 w-full max-w-xl flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-glow-gold">今夜想聊些什么？</h1>
          <p className="text-muted">跟随引导，一步步写下此刻的心境</p>
        </div>
        <ModuleManagerSheet
          moduleConfig={moduleConfig}
          onConfigChange={setModuleConfig}
        />
      </header>
      <WritingSteps moduleConfig={moduleConfig} expertStyle={expertStyle} customExpertTags={customExpertTags} />
    </main>
  );
}
