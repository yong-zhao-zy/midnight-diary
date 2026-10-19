"use client";

import { useEffect } from "react";

/**
 * Registers the Service Worker in production only.
 * Dev mode is skipped to avoid caching interference with HMR.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((registration) => {
          // 主动检查更新：iOS Safari 的 SW 更新时机不可控，不主动 update 可能长期停留在旧版本
          registration.update().catch(() => {});
        })
        .catch(() => {});
    };

    // Register after window load to avoid competing with first paint
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
