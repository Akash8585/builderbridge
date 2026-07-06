"use client";

import { useEffect } from "react";

/**
 * Registers the PWA service worker. Production-only: in dev, a service worker
 * caches Turbopack's HMR assets and causes confusing stale-code behavior.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration failure just means no offline support — never break the app.
    });
  }, []);

  return null;
}
