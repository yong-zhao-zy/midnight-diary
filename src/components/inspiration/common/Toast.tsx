"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * Local toast hook — mirrors the inline pattern used in ResponseLetter.tsx.
 * Auto-dismisses after 2500ms. Returns { message, showToast, ToastElement }.
 * Render <ToastElement /> at the desired location in the tree.
 */
export function useToast() {
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 2500);
    return () => clearTimeout(t);
  }, [message]);

  const showToast = useCallback((msg: string) => setMessage(msg), []);

  const ToastElement = message ? (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-lg bg-accent/10 border border-accent/20 text-sm text-accent text-center backdrop-blur-sm shadow-lg">
      {message}
    </div>
  ) : null;

  return { message, showToast, ToastElement };
}
