"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { DiaryDetail } from "@/components/diary/ResponseLetter";
import { getDiaryById, type DiaryRow } from "@/lib/diary-service";
import { DEFAULT_MODULE_CONFIG, type ModuleConfig } from "@/lib/module-config";
import { createClient } from "@/lib/supabase/client";
import type { CustomExpertTags } from "@/config/experts-config";

/**
 * Browse a diary in read-only mode (diary content + AI replies).
 * Renders the shared DiaryDetail as a standalone full-screen view.
 * Reaching here from the inspiration tab's 「原文」 button on note/practice cards.
 */
export function DiaryBrowseContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const [diary, setDiary] = useState<DiaryRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [moduleConfig, setModuleConfig] = useState<ModuleConfig[]>(DEFAULT_MODULE_CONFIG);
  const [expertStyle, setExpertStyle] = useState("warm_companion");
  const [customExpertTags, setCustomExpertTags] = useState<CustomExpertTags | null>(null);

  useEffect(() => {
    async function init() {
      if (!id) {
        setLoading(false);
        return;
      }

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

      const d = await getDiaryById(id);
      setDiary(d);
      setLoading(false);
    }

    init();
  }, [id]);

  const handleClose = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-glow-gold" />
      </main>
    );
  }

  if (!diary) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-muted">该日记不存在或已删除</p>
        <button
          onClick={handleClose}
          className="text-sm text-glow-gold/80 hover:text-glow-gold transition-colors"
        >
          返回
        </button>
      </main>
    );
  }

  return (
    <DiaryDetail
      entry={diary}
      isLatest={false}
      onClose={handleClose}
      moduleConfig={moduleConfig}
      expertStyle={expertStyle}
      customExpertTags={customExpertTags}
    />
  );
}
