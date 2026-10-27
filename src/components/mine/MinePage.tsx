"use client";

import { useRouter } from "next/navigation";
import { ChevronRight, Shield, UserCog } from "lucide-react";
import { ThemeSwitcher } from "@/components/my/ThemeSwitcher";

/** 「我的」一级模块下的三个区块 */
export type MineSection = "theme" | "admin" | "account";

interface MinePageProps {
  section: MineSection;
  username?: string;
}

/**
 * 一级模块「我的」：从原「每日一记-我的」里拆出来的三块
 * ——界面皮肤、管理后台、账号设置——各自独立成一个页签。
 * 管理后台页签是否展示由 page.tsx 按角色过滤；身份区（品牌名 + 欢迎语）
 * 跟人走，放在这里而不是「配置」。
 */
export function MinePage({ section, username }: MinePageProps) {
  const router = useRouter();

  return (
    <div className="space-y-6">
      {/* 身份区：品牌名 + 欢迎语 */}
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

      {section === "theme" && <ThemeSwitcher />}

      {section === "admin" && (
        <section className="rounded-2xl border border-line-2 bg-surface-2 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Shield className="h-4 w-4 text-accent/70" />
            <h2 className="text-sm font-medium text-ink/90">管理后台</h2>
          </div>

          <button
            onClick={() => router.push("/admin/invite-codes")}
            className="group flex w-full items-center justify-between rounded-xl border border-line-2 bg-surface-1 p-4 transition-all hover:border-accent/30 hover:bg-surface-2"
          >
            <div className="flex items-center gap-3 text-left">
              <span className="text-lg">🎫</span>
              <div>
                <p className="text-sm font-medium text-ink/85">内测码管理</p>
                <p className="mt-0.5 text-xs text-ink-2/60">生成、查看、删除邀请码</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-ink-2/50 transition-colors group-hover:text-accent/60" />
          </button>
        </section>
      )}

      {section === "account" && (
        <section className="rounded-2xl border border-line-2 bg-surface-2 p-5">
          <div className="mb-4 flex items-center gap-2">
            <UserCog className="h-4 w-4 text-accent/70" />
            <h2 className="text-sm font-medium text-ink/90">账号设置</h2>
          </div>

          <button
            onClick={() => router.push("/my/account")}
            className="group flex w-full items-center justify-between rounded-xl border border-line-2 bg-surface-1 p-4 transition-all hover:border-accent/30 hover:bg-surface-2"
          >
            <div className="flex items-center gap-3 text-left">
              <span className="text-lg">🔒</span>
              <div>
                <p className="text-sm font-medium text-ink/85">账号管理</p>
                <p className="mt-0.5 text-xs text-ink-2/60">注销账号与数据清除</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-ink-2/50 transition-colors group-hover:text-accent/60" />
          </button>
        </section>
      )}
    </div>
  );
}
