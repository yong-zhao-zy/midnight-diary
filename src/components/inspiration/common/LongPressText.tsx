"use client";

import { useState, useRef, useCallback, type ReactNode } from "react";
import { AnimatePresence } from "framer-motion";
import { LongPressMenu } from "./LongPressMenu";

interface LongPressTextProps {
  text: string;
  sourceDiaryId?: string | null;
  children: ReactNode;
  className?: string;
}

const LONG_PRESS_MS = 500;
const MOVE_THRESHOLD = 10; // px — cancel if finger moves beyond this

interface MenuState {
  /** Resolved text: user selection if available, otherwise full text */
  text: string;
  x: number;
  y: number;
}

/**
 * Check if the current window selection is non-empty and contained
 * within the given container element.
 */
function isSelectionInside(container: Element | null): boolean {
  if (!container) return false;
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return false;
  const range = selection.getRangeAt(0);
  return container.contains(range.commonAncestorContainer);
}

/**
 * Resolve the effective text for the menu:
 *   1. If there is a non-empty text selection inside the container, use it.
 *   2. Otherwise, fall back to the full `text` prop.
 */
function resolveText(container: Element | null, fullText: string): string {
  if (isSelectionInside(container)) {
    const selected = window.getSelection()?.toString().trim();
    if (selected && selected.length > 0) return selected;
  }
  return fullText;
}

/**
 * Wraps AI text content to enable long-press popup menu:
 * 复制 / 存为笔记 / 加入打卡.
 *
 * Long-press is triggered by:
 *   - Touch: 500ms press without movement
 *   - Desktop: right-click (contextmenu)
 *
 * Text resolution:
 *   - If the user has a non-empty text selection inside the container,
 *     the menu operates on the selected text only.
 *   - If no selection, the menu operates on the full `text` prop.
 *
 * When `text` is empty, long-press is disabled (no menu shown).
 *
 * Click prevention: after a long-press fires, the next click event is
 * preventDefault + stopPropagation'd so that parent onClick handlers
 * (e.g. list card onClick to open detail drawer) don't fire.
 */
export function LongPressText({
  text,
  sourceDiaryId,
  children,
  className,
}: LongPressTextProps) {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTriggeredRef = useRef<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startPosRef.current = null;
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!text) return;
      const touch = e.touches[0];
      startPosRef.current = { x: touch.clientX, y: touch.clientY };

      timerRef.current = setTimeout(() => {
        if (startPosRef.current) {
          longPressTriggeredRef.current = true;
          const effectiveText = resolveText(containerRef.current, text);
          setMenu({
            text: effectiveText,
            x: startPosRef.current.x,
            y: startPosRef.current.y,
          });
        }
      }, LONG_PRESS_MS);
    },
    [text]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!startPosRef.current) return;
      const touch = e.touches[0];
      const dx = touch.clientX - startPosRef.current.x;
      const dy = touch.clientY - startPosRef.current.y;
      if (Math.abs(dx) > MOVE_THRESHOLD || Math.abs(dy) > MOVE_THRESHOLD) {
        clearTimer();
      }
    },
    [clearTimer]
  );

  const handleTouchEnd = useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!text) return;
      e.preventDefault();
      e.stopPropagation();
      const effectiveText = resolveText(containerRef.current, text);
      setMenu({ text: effectiveText, x: e.clientX, y: e.clientY });
    },
    [text]
  );

  const handleClick = useCallback((e: React.MouseEvent) => {
    // Block the click that follows a long-press release so parent
    // onClick handlers (e.g. open diary detail) don't fire.
    if (longPressTriggeredRef.current) {
      e.preventDefault();
      e.stopPropagation();
      longPressTriggeredRef.current = false;
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className={className}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onContextMenu={handleContextMenu}
      onClick={handleClick}
    >
      {children}

      <AnimatePresence>
        {menu && (
          <LongPressMenu
            text={menu.text}
            sourceDiaryId={sourceDiaryId}
            anchorX={menu.x}
            anchorY={menu.y}
            onClose={() => setMenu(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
