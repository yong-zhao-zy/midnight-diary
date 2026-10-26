"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Palette, Settings, Shield, UserCog } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { ModuleManagerSheet } from "@/components/diary/ModuleManagerSheet";
import { ExpertSettings } from "./ExpertSettings";
import { MemoryCard } from "./MemoryCard";
import { PromptLabCard } from "./PromptLabCard";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { OFFICIAL_EXPERTS } from "@/config/experts-config";
import type { ModuleConfig } from "@/lib/module-config";
import type { CustomExpertTags } from "@/config/experts-config";

interface MySettingsProps {
  moduleConfig: ModuleConfig[];
  onModuleConfigChange: (config: ModuleConfig[]) => void;
  expertStyle: string;
  customExpertTags: CustomExpertTags | null;
  onExpertChange: (style: string, tags: CustomExpertTags | null) => void;
  userRole?: "user" | "admin";
  /** 身份区用：品牌名与欢迎语从全局头部收进「我的」，不占每个页签的顶部空间 */
  username?: string;
}

export function MySettings({
  moduleConfig,
  onModuleConfigChange,
  expertStyle,
  customExpertTags,
  onExpertChange,
  userRole = "user",
  username,
}: MySettingsProps) {
  const router = useRouter();
  const [showExpertSettings, setShowExpertSettings] = useState(false);
  const [moduleSheetOpen, setModuleSheetOpen] = useState(false);

  const currentExpert =
    expertStyle === "custom"
      ? { name: "自定义顾问", role: "手捏专属陪伴者" }
      : OFFICIAL_EXPERTS.find((e) => e.id === expertStyle) ?? OFFICIAL_EXPERTS[0];

  return (
    <>
      <div className="space-y-6">
        {/* 身份区：品牌名 + 欢迎语（原先常驻在每页顶部，现在收进身份页） */}
        <section className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-accent/20 bg-accent/10 text-base font-semibold text-accent">
            {username?.trim().slice(0, 1).toUpperCase() || "深"}
          </div>
          <div className="min-w-0">
            <h1 className="text-[17px] font-semibold leading-tight tracking-tight text-ink">
              深空回响
            </h1>
            <p className="mt-0.5 truncate text-xs text-ink-2/70">
              {username ? `欢迎回来，${username}` : "你的深夜回响"}
            </p>
          </div>
        </section>

        {/* Section: 界面皮肤 — 只换配色，布局不变 */}
        <ThemeSwitcher />

        {/* Section: Module Config — collapsed card */}
        <section className="rounded-2xl border border-line-2 bg-surface-2 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="h-4 w-4 text-accent/70" />
            <h2 className="text-sm font-medium text-ink/90">
              日记维度
            </h2>
          </div>

          <button
            onClick={() => setModuleSheetOpen(true)}
            className="w-full flex items-center justify-between p-4 rounded-xl border border-line-2 bg-surface-1 hover:border-accent/30 hover:bg-surface-2 transition-all group"
          >
            <div className="flex items-center gap-3 text-left">
              <span className="text-lg">⚙️</span>
              <div>
                <p className="text-sm font-medium text-ink/85">
                  日记维度管理
                </p>
                <p className="text-xs text-ink-2/60 mt-0.5">
                  重命名、隐藏、新增维度
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-ink-2/50 group-hover:text-accent/60 transition-colors" />
          </button>

          <ModuleManagerSheet
            moduleConfig={moduleConfig}
            onConfigChange={onModuleConfigChange}
            externalOpen={moduleSheetOpen}
            onExternalOpenChange={setModuleSheetOpen}
          />
        </section>

        {/* Section: Expert Style */}
        <section className="rounded-2xl border border-line-2 bg-surface-2 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Palette className="h-4 w-4 text-accent/70" />
            <h2 className="text-sm font-medium text-ink/90">
              AI 心理顾问
            </h2>
          </div>

          <button
            onClick={() => setShowExpertSettings(true)}
            className="w-full flex items-center justify-between p-4 rounded-xl border border-line-2 bg-surface-1 hover:border-accent/30 hover:bg-surface-2 transition-all group"
          >
            <div className="text-left">
              <p className="text-sm font-medium text-ink/85">
                {currentExpert.name}
              </p>
              <p className="text-xs text-ink-2/60 mt-0.5">
                {currentExpert.role}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-ink-2/50 group-hover:text-accent/60 transition-colors" />
          </button>
        </section>

        {/* Section: AI Memory (read-only) */}
        <MemoryCard />

        {/* Section: Prompt Lab */}
        <PromptLabCard />

        {/* Section: Admin (admin only) */}
        {userRole === "admin" && (
          <section className="rounded-2xl border border-line-2 bg-surface-2 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-4 w-4 text-accent/70" />
              <h2 className="text-sm font-medium text-ink/90">
                管理后台
              </h2>
            </div>

            <button
              onClick={() => router.push("/admin/invite-codes")}
              className="w-full flex items-center justify-between p-4 rounded-xl border border-line-2 bg-surface-1 hover:border-accent/30 hover:bg-surface-2 transition-all group"
            >
              <div className="flex items-center gap-3 text-left">
                <span className="text-lg">🎫</span>
                <div>
                  <p className="text-sm font-medium text-ink/85">
                    内测码管理
                  </p>
                  <p className="text-xs text-ink-2/60 mt-0.5">
                    生成、查看、删除邀请码
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-ink-2/50 group-hover:text-accent/60 transition-colors" />
            </button>
          </section>
        )}

        {/* Section: Account Settings */}
        <section className="rounded-2xl border border-line-2 bg-surface-2 p-5">
          <div className="flex items-center gap-2 mb-4">
            <UserCog className="h-4 w-4 text-accent/70" />
            <h2 className="text-sm font-medium text-ink/90">
              账号设置
            </h2>
          </div>

          <button
            onClick={() => router.push("/my/account")}
            className="w-full flex items-center justify-between p-4 rounded-xl border border-line-2 bg-surface-1 hover:border-accent/30 hover:bg-surface-2 transition-all group"
          >
            <div className="flex items-center gap-3 text-left">
              <span className="text-lg">🔒</span>
              <div>
                <p className="text-sm font-medium text-ink/85">
                  账号管理
                </p>
                <p className="text-xs text-ink-2/60 mt-0.5">
                  注销账号与数据清除
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-ink-2/50 group-hover:text-accent/60 transition-colors" />
          </button>
        </section>
      </div>

      {/* Expert Settings Overlay */}
      <AnimatePresence>
        {showExpertSettings && (
          <ExpertSettings
            currentStyle={expertStyle}
            currentTags={customExpertTags}
            onSave={(style, tags) => {
              onExpertChange(style, tags);
              setShowExpertSettings(false);
            }}
            onClose={() => setShowExpertSettings(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
