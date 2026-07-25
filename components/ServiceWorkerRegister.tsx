"use client";

import { useEffect } from "react";

// Registration has to happen client-side (no `navigator` during SSR) — this
// renders nothing, it's purely a mount-time side effect. Silently no-ops on
// browsers without service worker support instead of throwing, since this
// is a progressive enhancement (installability + an offline fallback page),
// never something the rest of the app depends on to function.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  return null;
}
