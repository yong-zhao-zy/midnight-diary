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

interface MenuAnchor {
  x: number;
  y: number;
}

/**
 * Wraps AI text content to enable long-press popup menu:
 * 复制 / 存为笔记 / 加入打卡.
 *
 * Long-press is triggered by:
 *   - Touch: 500ms press without movement
 *   - Desktop: right-click (contextmenu)
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
  const [menu, setMenu] = useState<MenuAnchor | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTriggeredRef = useRef<boolean>(false);

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
          setMenu({
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
      setMenu({ x: e.clientX, y: e.clientY });
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
            text={text}
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
