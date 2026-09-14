"use client";

import { useState, useRef, useCallback, useEffect, useMemo, type ReactNode } from "react";
import { AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import { LongPressMenu } from "./LongPressMenu";

interface LongPressTextProps {
  text: string;
  sourceDiaryId?: string | null;
  /** If provided, renders this content as-is with a single whole-text 收藏 button (used
   *  by the list preview, where line-clamp must apply to one block). If omitted,
   *  the text is split into paragraphs by blank lines, each with its own button. */
  children?: ReactNode;
  className?: string;
  /** className for auto-rendered paragraphs (when no children). */
  paragraphClassName?: string;
}

/** Debounce after selection stops changing before showing the menu (desktop only). */
const DEBOUNCE_MS = 300;

/** Rough menu width for horizontal clamping on touch. */
const MENU_WIDTH_EST = 120;

const DEFAULT_PARAGRAPH_CLASS = "text-sm text-foreground/85 leading-7 whitespace-pre-wrap";

interface MenuState {
  text: string;
  hasSelection: boolean;
  x: number;
  y: number;
}

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
 *   - Touch devices (no hover + coarse pointer): a「收藏」button appears below each
 *     paragraph (text is split by blank lines). One tap opens the menu acting on
 *     that paragraph only. The paragraph itself is not click-bound, so scrolling
 *     and native drag-select-copy work without interference.
 *   - Desktop: drag-select text → debounced menu (selectionchange). Right-click
 *     without selection → menu with 复制 only.
 *
 * If `children` is provided (list preview), the text is rendered as a single block
 * with one whole-text button instead of being split — so line-clamp still works.
 */
export function LongPressText({
  text,
  sourceDiaryId,
  children,
  className,
  paragraphClassName,
}: LongPressTextProps) {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [isTouch, setIsTouch] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const paragraphs = useMemo(
    () => text.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean),
    [text]
  );

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

  // Touch: tap 收藏 → menu acting on the given paragraph text (not the whole AI reply).
  const handleSaveTap = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>, paraText: string) => {
      e.stopPropagation();
      const r = e.currentTarget.getBoundingClientRect();
      const centerX = r.left + r.width / 2;
      const x = Math.max(16, Math.min(centerX, window.innerWidth - MENU_WIDTH_EST - 16));
      setMenu({ text: paraText, hasSelection: true, x, y: r.bottom + 8 });
    },
    []
  );

  const handleClose = useCallback(() => {
    setMenu(null);
    if (!isTouch) window.getSelection()?.removeAllRanges();
  }, [isTouch]);

  const renderSaveButton = (paraText: string) => (
    <div className="flex justify-end mt-2">
      <button
        type="button"
        aria-label="存为笔记或加入打卡"
        onClick={(e) => handleSaveTap(e, paraText)}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-glow-gold/5 border border-glow-gold/20 text-glow-gold/70 hover:bg-glow-gold/10 hover:text-glow-gold active:scale-95 transition"
      >
        <Sparkles className="h-3.5 w-3.5" />
        <span className="text-xs">收藏</span>
      </button>
    </div>
  );

  const paraClass = paragraphClassName ?? DEFAULT_PARAGRAPH_CLASS;

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
      {children != null ? (
        <>
          {children}
          {isTouch && text && renderSaveButton(text)}
        </>
      ) : (
        paragraphs.map((para, i) => (
          <div key={i} className={i > 0 ? "mt-6" : ""}>
            <p className={paraClass}>{para}</p>
            {isTouch && renderSaveButton(para)}
          </div>
        ))
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
