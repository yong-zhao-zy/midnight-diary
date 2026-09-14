"use client";

import { useState, useRef, useCallback, useEffect, type ReactNode } from "react";
import { AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import { LongPressMenu } from "./LongPressMenu";

interface LongPressTextProps {
  text: string;
  sourceDiaryId?: string | null;
  children: ReactNode;
  className?: string;
}

/** Debounce after selection stops changing before showing the menu (desktop only). */
const DEBOUNCE_MS = 300;

/** Rough menu width for horizontal clamping on touch. */
const MENU_WIDTH_EST = 120;

interface MenuState {
  text: string;
  hasSelection: boolean;
  x: number;
  y: number;
}

/**
 * True if the current window selection is non-empty and falls inside container.
 */
function isSelectionInside(container: Element | null): boolean {
  if (!container) return false;
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return false;
  const range = selection.getRangeAt(0);
  return container.contains(range.commonAncestorContainer);
}

/**
 * Wraps AI text to show a custom save menu.
 *
 * Two interaction models, picked at runtime:
 *   - Touch devices (no hover + coarse pointer): a「收藏」button appears below the
 *     paragraph. One tap opens the menu with 复制 / 存为笔记 / 加入打卡 acting on the
 *     whole paragraph. The paragraph itself is not click-bound, so scrolling and
 *     native drag-select-copy work without interference. This sidesteps the
 *     multi-step, imprecise long-press-to-select flow that mobile browsers impose.
 *   - Desktop: drag-select text → debounced menu (selectionchange). Right-click
 *     without selection → menu with 复制 only.
 *
 * `user-select: text` is kept on both so users can always drag-select to copy via
 * the browser's native edit menu; on touch the custom menu simply no longer hooks
 * selectionchange, avoiding a double-menu.
 */
export function LongPressText({
  text,
  sourceDiaryId,
  children,
  className,
}: LongPressTextProps) {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [isTouch, setIsTouch] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detect touch device once on mount.
  useEffect(() => {
    const mq = window.matchMedia("(hover: none) and (pointer: coarse)");
    setIsTouch(mq.matches);
  }, []);

  // Desktop only: selectionchange → debounced menu.
  useEffect(() => {
    if (isTouch) return;
    const onSelectionChange = () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }

      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;

        if (!isSelectionInside(containerRef.current)) return;

        const selection = window.getSelection();
        const selected = selection?.toString().trim();
        if (!selected || !selection || selection.rangeCount === 0) return;

        const rect = selection.getRangeAt(0).getBoundingClientRect();
        setMenu({
          text: selected,
          hasSelection: true,
          x: rect.left + rect.width / 2,
          y: rect.bottom,
        });
      }, DEBOUNCE_MS);
    };

    document.addEventListener("selectionchange", onSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [isTouch]);

  // Desktop: right-click without selection → show 复制 only.
  // Right-click WITH selection → flush debounce and show immediately.
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (isTouch || !text) return;
      e.preventDefault();
      e.stopPropagation();

      if (isSelectionInside(containerRef.current)) {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
          debounceRef.current = null;
        }
        const selected = window.getSelection()?.toString().trim();
        if (selected) {
          setMenu({ text: selected, hasSelection: true, x: e.clientX, y: e.clientY });
          return;
        }
      }

      setMenu({ text, hasSelection: false, x: e.clientX, y: e.clientY });
    },
    [text, isTouch]
  );

  // Touch: tap the 收藏 button → menu acting on the whole paragraph.
  const handleSaveTap = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      const r = e.currentTarget.getBoundingClientRect();
      const centerX = r.left + r.width / 2;
      const x = Math.max(16, Math.min(centerX, window.innerWidth - MENU_WIDTH_EST - 16));
      setMenu({
        text,
        hasSelection: true,
        x,
        y: r.bottom + 8,
      });
    },
    [text]
  );

  const handleClose = useCallback(() => {
    setMenu(null);
    if (!isTouch) window.getSelection()?.removeAllRanges();
  }, [isTouch]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        WebkitTouchCallout: "none",
        WebkitUserSelect: "text",
        userSelect: "text",
      } as React.CSSProperties}
      onContextMenu={handleContextMenu}
    >
      {children}

      {isTouch && text && (
        <div className="flex justify-end mt-2">
          <button
            type="button"
            aria-label="存为笔记或加入打卡"
            onClick={handleSaveTap}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-glow-gold/5 border border-glow-gold/20 text-glow-gold/70 hover:bg-glow-gold/10 hover:text-glow-gold active:scale-95 transition"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="text-xs">收藏</span>
          </button>
        </div>
      )}

      <AnimatePresence>
        {menu && (
          <LongPressMenu
            text={menu.text}
            hasSelection={menu.hasSelection}
            sourceDiaryId={sourceDiaryId}
            anchorX={menu.x}
            anchorY={menu.y}
            onClose={handleClose}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
