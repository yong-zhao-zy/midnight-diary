"use client";

import { useState, useRef, useCallback, useEffect, type ReactNode } from "react";
import { AnimatePresence } from "framer-motion";
import { LongPressMenu } from "./LongPressMenu";

interface LongPressTextProps {
  text: string;
  sourceDiaryId?: string | null;
  children: ReactNode;
  className?: string;
}

/** Debounce after selection stops changing before showing the menu. */
const DEBOUNCE_MS = 300;

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
 * Wraps AI text to show a custom save menu after the user selects text.
 *
 * Trigger behaviour:
 *   - iOS / Android: long-press triggers the native selection handles (magnifier);
 *     once the user lifts their finger and the selection stabilises, a custom menu
 *     appears with 存为笔记 / 加入打卡 (and 复制).
 *   - Desktop: drag-select text → same debounced menu appears.
 *   - Desktop right-click without a selection → menu with 复制 only.
 *
 * Implementation uses the `selectionchange` DOM event (debounced 300 ms) so it
 * works naturally with iOS selection handles without fighting the browser.
 * No custom long-press timer is needed.
 */
export function LongPressText({
  text,
  sourceDiaryId,
  children,
  className,
}: LongPressTextProps) {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Listen to native selectionchange on the document.
  // Shows the menu DEBOUNCE_MS after the selection stops changing.
  useEffect(() => {
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
  }, []);

  // Desktop: right-click without selection → show 复制 only.
  // Right-click WITH selection → flush debounce and show immediately.
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!text) return;
      e.preventDefault();
      e.stopPropagation();

      if (isSelectionInside(containerRef.current)) {
        // Flush debounce so the menu shows immediately on right-click
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

      // No selection — full text, 复制 only
      setMenu({ text, hasSelection: false, x: e.clientX, y: e.clientY });
    },
    [text]
  );

  // Clear selection when menu is dismissed
  const handleClose = useCallback(() => {
    setMenu(null);
    window.getSelection()?.removeAllRanges();
  }, []);

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
