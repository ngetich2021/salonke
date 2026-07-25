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

// Fixed, always-visible install affordance — bottom-right on every page,
// above everything except the sticky ad player (z-40) and header (z-50), so
// it never gets buried in page content but also never fights the chrome
// that's already claiming the top of the screen.
//
// Chrome/Edge/Android fire `beforeinstallprompt` when the PWA install
// criteria (manifest + service worker + HTTPS) are met — that event is the
// *only* way to trigger the native install prompt, and it's only usable
// once, synchronously in response to a user gesture, which is why it has to
// be captured and held in state rather than re-requested on click. iOS
// Safari never fires this event at all (there's no programmatic install API
// there — "Add to Home Screen" is a manual step under the native Share
// sheet), so that path gets its own instruction bubble instead of a prompt.
export function InstallAppButton() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  // Lazy initializers run once during the client's first render, before any
  // effect — computing these here (rather than via setState inside an
  // effect body) avoids an extra render pass and the flash of a button that
  // immediately hides itself. `typeof window` guards the SSR pass, where
  // neither check has anything to read yet.
  const [installed, setInstalled] = useState(() => typeof window !== "undefined" && isStandalone());
  const [iosEligible] = useState(() => typeof window !== "undefined" && isIos());
  const [showIosHint, setShowIosHint] = useState(false);

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

  if (installed) return null;
  if (!installEvent && !iosEligible) return null;

  async function handleClick() {
    if (installEvent) {
      await installEvent.prompt();
      const { outcome } = await installEvent.userChoice;
      if (outcome === "accepted") setInstalled(true);
      setInstallEvent(null);
      return;
    }
    setShowIosHint((v) => !v);
  }

  return (
    <div className="fixed bottom-4 right-4 z-30 flex flex-col items-end gap-2">
      {showIosHint && (
        <div className="max-w-56 rounded-xl border border-black/[.08] bg-white p-3 text-xs shadow-lg dark:border-white/[.145] dark:bg-zinc-900">
          Tap <span className="font-semibold">Share</span> in Safari, then{" "}
          <span className="font-semibold">Add to Home Screen</span>.
        </div>
      )}
      <button
        type="button"
        onClick={handleClick}
        className="flex items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-xs font-medium text-background shadow-lg"
      >
        ⬇ Install App
      </button>
    </div>
  );
}
