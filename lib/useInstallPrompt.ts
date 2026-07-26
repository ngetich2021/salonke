"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari's own (non-standard) flag for "already added to home screen".
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// Chrome/Edge/Android fire `beforeinstallprompt` when the PWA install
// criteria (manifest + service worker + HTTPS) are met — that event is the
// *only* way to trigger the native install prompt, and it's only usable
// once, synchronously in response to a user gesture, which is why it has to
// be captured and held in state rather than re-requested on click. iOS
// Safari never fires this event at all (there's no programmatic install API
// there — "Add to Home Screen" is a manual step under the native Share
// sheet). And even on Chrome/Edge, the event is heuristic-gated (engagement
// signals, a prior dismissal cooldown) so it may simply not have fired yet
// on a given visit — that's not an error state, just "not offered by the
// browser this time". `installable` therefore stays true any time the app
// isn't already installed, so the entry point itself (e.g. a nav link) is
// always visible instead of flickering in and out with browser heuristics;
// callers fall back to their own instruction UI whenever `promptInstall`
// resolves "ios" or "manual".
export function useInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  // Lazy initializers run once during the client's first render, before any
  // effect — computing these here (rather than via setState inside an
  // effect body) avoids an extra render pass and the flash of a control that
  // immediately hides itself. `typeof window` guards the SSR pass, where
  // neither check has anything to read yet.
  const [installed, setInstalled] = useState(() => typeof window !== "undefined" && isStandalone());
  const [iosEligible] = useState(() => typeof window !== "undefined" && isIos());

  useEffect(() => {
    if (installed) return;

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setInstalled(true);
      setInstallEvent(null);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [installed]);

  const installable = !installed;

  async function promptInstall(): Promise<"accepted" | "dismissed" | "ios" | "manual"> {
    if (installEvent) {
      await installEvent.prompt();
      const { outcome } = await installEvent.userChoice;
      if (outcome === "accepted") setInstalled(true);
      setInstallEvent(null);
      return outcome;
    }
    if (iosEligible) return "ios";
    return "manual";
  }

  return { installable, promptInstall };
}
