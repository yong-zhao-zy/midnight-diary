"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Palette, Settings, Shield, UserCog } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { ModuleManagerSheet } from "@/components/diary/ModuleManagerSheet";
import { ExpertSettings } from "./ExpertSettings";
import { MemoryCard } from "./MemoryCard";
import { PromptLabCard } from "./PromptLabCard";
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
}

export function MySettings({
  moduleConfig,
  onModuleConfigChange,
  expertStyle,
  customExpertTags,
  onExpertChange,
  userRole = "user",
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
        {/* Section: Module Config — collapsed card */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="h-4 w-4 text-glow-gold/70" />
            <h2 className="text-sm font-medium text-foreground/90">
              日记维度
            </h2>
          </div>

          <button
            onClick={() => setModuleSheetOpen(true)}
            className="w-full flex items-center justify-between p-4 rounded-xl border border-white/8 bg-white/[0.02] hover:border-glow-gold/30 hover:bg-white/[0.04] transition-all group"
          >
            <div className="flex items-center gap-3 text-left">
              <span className="text-lg">⚙️</span>
              <div>
                <p className="text-sm font-medium text-foreground/85">
                  日记维度管理
                </p>
                <p className="text-xs text-muted/50 mt-0.5">
                  重命名、隐藏、新增维度
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted/40 group-hover:text-glow-gold/60 transition-colors" />
          </button>

          <ModuleManagerSheet
            moduleConfig={moduleConfig}
            onConfigChange={onModuleConfigChange}
            externalOpen={moduleSheetOpen}
            onExternalOpenChange={setModuleSheetOpen}
          />
        </section>

        {/* Section: Expert Style */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Palette className="h-4 w-4 text-glow-gold/70" />
            <h2 className="text-sm font-medium text-foreground/90">
              AI 心理顾问
            </h2>
          </div>

          <button
            onClick={() => setShowExpertSettings(true)}
            className="w-full flex items-center justify-between p-4 rounded-xl border border-white/8 bg-white/[0.02] hover:border-glow-gold/30 hover:bg-white/[0.04] transition-all group"
          >
            <div className="text-left">
              <p className="text-sm font-medium text-foreground/85">
                {currentExpert.name}
              </p>
              <p className="text-xs text-muted/50 mt-0.5">
                {currentExpert.role}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted/40 group-hover:text-glow-gold/60 transition-colors" />
          </button>
        </section>

        {/* Section: AI Memory (read-only) */}
        <MemoryCard />

        {/* Section: Prompt Lab */}
        <PromptLabCard />

        {/* Section: Admin (admin only) */}
        {userRole === "admin" && (
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-4 w-4 text-glow-gold/70" />
              <h2 className="text-sm font-medium text-foreground/90">
                管理后台
              </h2>
            </div>

            <button
              onClick={() => router.push("/admin/invite-codes")}
              className="w-full flex items-center justify-between p-4 rounded-xl border border-white/8 bg-white/[0.02] hover:border-glow-gold/30 hover:bg-white/[0.04] transition-all group"
            >
              <div className="flex items-center gap-3 text-left">
                <span className="text-lg">🎫</span>
                <div>
                  <p className="text-sm font-medium text-foreground/85">
                    内测码管理
                  </p>
                  <p className="text-xs text-muted/50 mt-0.5">
                    生成、查看、删除邀请码
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted/40 group-hover:text-glow-gold/60 transition-colors" />
            </button>
          </section>
        )}

        {/* Section: Account Settings */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-2 mb-4">
            <UserCog className="h-4 w-4 text-glow-gold/70" />
            <h2 className="text-sm font-medium text-foreground/90">
              账号设置
            </h2>
          </div>

          <button
            onClick={() => router.push("/my/account")}
            className="w-full flex items-center justify-between p-4 rounded-xl border border-white/8 bg-white/[0.02] hover:border-glow-gold/30 hover:bg-white/[0.04] transition-all group"
          >
            <div className="flex items-center gap-3 text-left">
              <span className="text-lg">🔒</span>
              <div>
                <p className="text-sm font-medium text-foreground/85">
                  账号管理
                </p>
                <p className="text-xs text-muted/50 mt-0.5">
                  注销账号与数据清除
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted/40 group-hover:text-glow-gold/60 transition-colors" />
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
