"use client";

import { Check, Paintbrush } from "lucide-react";
import { THEMES, useTheme, type ThemeId } from "@/lib/theme";

/**
 * 皮肤选择器：只换配色，不动布局与模块结构。
 * 三张卡片各自展示「底色 / 主色 / 文字色」三个色点，选中态用主色描边。
 */
export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <section className="rounded-2xl border border-line-2 bg-surface-2 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Paintbrush className="h-4 w-4 text-accent/70" />
        <h2 className="text-sm font-medium text-ink/90">界面皮肤</h2>
        <span className="ml-auto text-xs text-ink-2/50">只换配色</span>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {THEMES.map((t) => {
          const active = t.id === theme;
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={active}
              onClick={() => setTheme(t.id as ThemeId)}
              className={`relative flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all ${
                active
                  ? "border-accent/60 bg-surface-4"
                  : "border-line-2 bg-surface-1 hover:border-line-3 hover:bg-surface-2"
              }`}
            >
              {/* 色卡预览：底色铺满 + 主色圆点 + 文字色短线 */}
              <div
                className="relative h-9 w-full rounded-lg border border-line-1 overflow-hidden"
                style={{ backgroundColor: t.swatch[0] }}
              >
                <span
                  className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full"
                  style={{ backgroundColor: t.swatch[1] }}
                />
                <span
                  className="absolute right-2 top-1/2 h-1 w-6 -translate-y-1/2 rounded-full"
                  style={{ backgroundColor: t.swatch[2], opacity: 0.85 }}
                />
              </div>

              <div className="w-full">
                <p className={`text-xs font-medium ${active ? "text-ink" : "text-ink/80"}`}>
                  {t.name}
                </p>
                <p className="mt-0.5 text-[10px] leading-tight text-ink-2/60">{t.desc}</p>
              </div>

              {active && (
                <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-accent">
                  <Check className="h-2.5 w-2.5 text-accent-ink" strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
