"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Calendar } from "lucide-react";
import { WritingSteps } from "@/components/diary/WritingSteps";
import { DiaryEditView } from "@/components/diary/DiaryEditView";
import { ModuleManagerSheet } from "@/components/diary/ModuleManagerSheet";
import { getDiaryById, getDiaryByDate, type DiaryRow } from "@/lib/diary-service";
import { DEFAULT_MODULE_CONFIG, type ModuleConfig } from "@/lib/module-config";
import { createClient } from "@/lib/supabase/client";
import type { CustomExpertTags } from "@/config/experts-config";

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function WriteContent() {
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");

  const [diary, setDiary] = useState<DiaryRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [moduleConfig, setModuleConfig] = useState<ModuleConfig[]>(DEFAULT_MODULE_CONFIG);
  const [expertStyle, setExpertStyle] = useState("warm_companion");
  const [customExpertTags, setCustomExpertTags] = useState<CustomExpertTags | null>(null);
  const [diaryDate, setDiaryDate] = useState<string>(() => toLocalDateStr(new Date()));
  const [dateToast, setDateToast] = useState("");
  const [dateChecking, setDateChecking] = useState(false);

  const today = toLocalDateStr(new Date());

  useEffect(() => {
    if (dateToast) {
      const t = setTimeout(() => setDateToast(""), 2500);
      return () => clearTimeout(t);
    }
  }, [dateToast]);

  const handleDateChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    if (!newDate || newDate === diaryDate || dateChecking) return;
    // Future date lock — mirrors detail page (PATCH API) validation
    if (newDate > today) {
      setDateToast("不能选择未来的日期");
      return;
    }
    setDateChecking(true);
    try {
      const existing = await getDiaryByDate(newDate);
      if (existing) {
        setDateToast("该日期已有日记，请直接编辑");
        return;
      }
      setDiaryDate(newDate);
    } catch {
      setDateToast("日期检查失败，请重试");
    } finally {
      setDateChecking(false);
    }
  };

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
  const [y, m, d] = diaryDate.split("-").map(Number);
  const formattedDate = `${y}年${m}月${d}日`;

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <header className="mb-10 w-full max-w-xl flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-glow-gold">今夜想聊些什么？</h1>
          <div className="flex items-center gap-2">
            <div className="relative group cursor-pointer flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-muted/40 group-hover:text-muted/70 transition-colors shrink-0" />
              <span className="text-sm text-muted group-hover:text-foreground/80 transition-colors">
                {formattedDate}
              </span>
              {dateChecking && (
                <Loader2 className="h-3 w-3 animate-spin text-glow-gold/70 shrink-0" />
              )}
              <input
                type="date"
                max={today}
                value={diaryDate}
                onChange={handleDateChange}
                disabled={dateChecking}
                aria-label="选择日记日期"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
            </div>
            {dateToast && (
              <span className="text-xs text-glow-gold/80">{dateToast}</span>
            )}
          </div>
        </div>
        <ModuleManagerSheet
          moduleConfig={moduleConfig}
          onConfigChange={setModuleConfig}
        />
      </header>
      <WritingSteps moduleConfig={moduleConfig} expertStyle={expertStyle} customExpertTags={customExpertTags} diaryDate={diaryDate} />
    </main>
  );
}
