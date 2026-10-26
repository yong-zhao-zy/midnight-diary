"use client";

import { useRef, type ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

export interface ModuleDef {
  key: string;
  label: string;
}

export interface NavTab {
  key: string;
  label: string;
}

interface ModuleNavProps {
  modules: ModuleDef[];
  activeModule: string;
  onModuleChange: (key: string) => void;
  /** 当前模块下的二级页签 */
  tabs: NavTab[];
  activeTab: string;
  onTabChange: (key: string) => void;
  /** 页签行右侧的补充操作（如「每日好饭」的健康画像入口） */
  tabBarRight?: ReactNode;
  /** 标题行右侧的常驻操作（换肤、手机/PC、退出） */
  titleRight?: ReactNode;
}

/**
 * 双层导航的新形态（方案 B）。
 *
 * 旧版的问题是两层胶囊长得一模一样：模块胶囊、页签胶囊，主次全靠颜色深浅，
 * 实质上等于把 9 个目的地堆在同一个视觉层级里。
 *
 * 现在两级形态彻底分开：
 * - 一级 = 页面大标题（17px 选中 / 13px 未选中 + 底部指示条），可点击、可在标题区左右滑动；
 * - 二级 = 下划线文字页签（13px，1.5px 指示条）。
 * tab 数量与对象一个没删，只是换了形态和位置。
 */
export function ModuleNav({
  modules,
  activeModule,
  onModuleChange,
  tabs,
  activeTab,
  onTabChange,
  tabBarRight,
  titleRight,
}: ModuleNavProps) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // 横向位移要明显大于纵向，避免和页面滚动抢手势
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    const idx = modules.findIndex((m) => m.key === activeModule);
    const next = dx < 0 ? idx + 1 : idx - 1;
    if (next >= 0 && next < modules.length) onModuleChange(modules[next].key);
  };

  return (
    <div className="mb-4">
      {/* 一级：模块大标题 + 常驻操作 */}
      <div className="flex items-end justify-between gap-3">
        <div
          className="flex items-baseline gap-5"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {modules.map((m) => {
            const active = m.key === activeModule;
            return (
              <button
                key={m.key}
                onClick={() => onModuleChange(m.key)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative select-none pb-1.5 transition-all duration-200",
                  active
                    ? "text-[17px] font-semibold tracking-tight text-ink"
                    : "text-[13px] font-normal text-ink-2/45 hover:text-ink-2/75"
                )}
              >
                {m.label}
                {active && (
                  <motion.span
                    layoutId="module-indicator"
                    className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-accent"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {titleRight && (
          <div className="flex shrink-0 items-center gap-0.5 pb-1">{titleRight}</div>
        )}
      </div>

      {/* 二级：下划线页签 */}
      <div className="mt-2 flex items-center gap-3 border-b border-line-1">
        <div className="flex items-center gap-5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((t) => {
            const active = t.key === activeTab;
            return (
              <button
                key={t.key}
                onClick={() => onTabChange(t.key)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative shrink-0 select-none pb-2.5 pt-1 text-[13px] transition-colors",
                  active ? "font-medium text-ink" : "text-ink-2/50 hover:text-ink-2/85"
                )}
              >
                {t.label}
                {active && (
                  <motion.span
                    layoutId="nav-tab-indicator"
                    className="absolute inset-x-0 -bottom-px h-[1.5px] rounded-full bg-accent"
                    transition={{ type: "spring", stiffness: 480, damping: 38 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {tabBarRight && (
          <div className="mb-1.5 ml-auto shrink-0">{tabBarRight}</div>
        )}
      </div>
    </div>
  );
}
