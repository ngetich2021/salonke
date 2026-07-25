"use client";

import { useState, useSyncExternalStore } from "react";
import { recordAdvertShareAction } from "@/lib/actions";

// navigator.share only exists in the browser and never changes after load,
// so there's nothing to subscribe to — this just needs a snapshot that's
// safe to read on both server (no navigator: false) and client (real
// capability), without the hydration mismatch a useEffect+setState flash
// would otherwise risk.
function subscribeNever() {
  return () => {};
}
function getNativeShareSnapshot() {
  return typeof navigator !== "undefined" && !!navigator.share;
}
function getNativeShareServerSnapshot() {
  return false;
}

// Inline (bundled, no network request) official brand marks — swapped in
// for the previous emoji glyphs, which rendered inconsistently across
// platforms and didn't read as the actual brand.
function WhatsAppIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2c-5.5 0-9.96 4.46-9.96 9.96 0 1.76.46 3.44 1.33 4.94L2 22l5.24-1.37a9.9 9.9 0 0 0 4.8 1.23h.01c5.5 0 9.96-4.46 9.96-9.96S17.54 2 12.04 2Zm5.83 14.24c-.25.7-1.24 1.28-2.02 1.44-.55.12-1.26.21-3.67-.79-2.63-1.09-4.55-3.51-4.7-3.72-.14-.2-1.11-1.48-1.11-2.83 0-1.34.7-1.99.95-2.27.25-.27.55-.34.73-.34h.53c.17 0 .4-.06.62.48.25.6.85 2.06.92 2.21.07.15.12.32.02.52-.1.2-.15.32-.3.5-.15.17-.31.39-.44.52-.15.15-.3.31-.13.6.17.3.77 1.27 1.65 2.05 1.14 1.02 2.1 1.34 2.4 1.49.3.15.47.13.65-.08.17-.2.75-.87.95-1.17.2-.3.4-.24.66-.15.27.1 1.72.81 2.02.96.3.15.5.22.57.35.07.13.07.75-.18 1.44Z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M24 12.07c0-6.63-5.37-12-12-12S0 5.44 0 12.07C0 18.06 4.39 23.02 10.13 23.93v-8.39H7.08v-3.47h3.05V9.41c0-3.01 1.79-4.67 4.53-4.67 1.31 0 2.68.24 2.68.24v2.95h-1.51c-1.49 0-1.96.93-1.96 1.87v2.25h3.33l-.53 3.47h-2.8v8.39C19.61 23.02 24 18.06 24 12.07Z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.97 6.82H1.68l7.73-8.84L1.25 2.25h6.83l4.71 6.23Zm-1.16 17.52h1.83L7.08 4.13H5.12Z" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0Zm5.57 8.24c-.18 1.9-.96 6.5-1.36 8.63-.17.9-.5 1.2-.82 1.23-.7.06-1.22-.46-1.9-.9-1.06-.7-1.65-1.12-2.68-1.8-1.18-.78-.42-1.21.26-1.91.18-.18 3.25-2.98 3.31-3.23.01-.03.01-.15-.06-.21-.07-.06-.17-.04-.25-.02-.1.02-1.79 1.14-5.06 3.35-.48.33-.91.49-1.3.48-.43-.01-1.25-.24-1.87-.44-.75-.24-1.35-.37-1.3-.79.03-.22.32-.44.9-.66 3.5-1.52 5.83-2.53 7-3.01 3.33-1.39 4.02-1.63 4.47-1.64.1 0 .32.02.47.14.12.1.16.23.17.33.02.09.03.28.02.44Z" />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm1.2 2 7.44 5.58a.6.6 0 0 0 .72 0L19.8 7Zm-.2 1.25V17h16V8.25l-7.16 5.37a2.6 2.6 0 0 1-3.12 0L4 8.25Z" />
    </svg>
  );
}

function ShareGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18 16.08a2.9 2.9 0 0 0-1.94.75l-7.05-4.11c.06-.24.09-.48.09-.72s-.03-.48-.09-.72l6.97-4.06c.53.49 1.23.79 2.02.79a2.99 2.99 0 1 0-2.99-2.99c0 .24.03.48.09.72L8.12 9.8a2.99 2.99 0 1 0 0 4.4l7.05 4.12c-.05.21-.08.43-.08.66a2.92 2.92 0 1 0 2.91-2.9Z" />
    </svg>
  );
}

const PLATFORMS = [
  { key: "whatsapp", label: "WhatsApp", Icon: WhatsAppIcon, className: "bg-[#25D366] text-white" },
  { key: "facebook", label: "Facebook", Icon: FacebookIcon, className: "bg-[#1877F2] text-white" },
  { key: "x", label: "X", Icon: XIcon, className: "bg-black text-white" },
  { key: "telegram", label: "Telegram", Icon: TelegramIcon, className: "bg-[#26A5E4] text-white" },
  { key: "email", label: "Email", Icon: EmailIcon, className: "bg-zinc-600 text-white" },
] as const;

type PlatformKey = (typeof PLATFORMS)[number]["key"] | "native" | "copy";

// Builds the shareable link that other component instances use to jump
// straight to this advert (see AdvertPlayer's `?ad=` handling) and to count
// a "shared fully" reach once opened (see `?ref=` handling there).
async function buildShareUrl(advertId: string, platform: PlatformKey) {
  const { shareId } = await recordAdvertShareAction(advertId, platform);
  const url = new URL(window.location.origin + "/");
  url.searchParams.set("ad", advertId);
  url.searchParams.set("ref", shareId);
  return url.toString();
}

export function ShareButtons({
  advertId,
  productName,
}: {
  advertId: string;
  productName: string;
}) {
  const canNativeShare = useSyncExternalStore(
    subscribeNever,
    getNativeShareSnapshot,
    getNativeShareServerSnapshot
  );
  const [copied, setCopied] = useState(false);
  const [justShared, setJustShared] = useState<PlatformKey | null>(null);

  function celebrate(platform: PlatformKey) {
    setJustShared(platform);
    setTimeout(() => setJustShared((p) => (p === platform ? null : p)), 2000);
  }

  async function handleNativeShare() {
    const url = await buildShareUrl(advertId, "native");
    try {
      await navigator.share({ title: productName, text: `Check out ${productName}! 🎉`, url });
    } catch {
      // Cancelled or unsupported mid-flow — already counted as a share
      // attempt above, nothing else to do.
    }
    celebrate("native");
  }

  async function handlePlatform(platform: (typeof PLATFORMS)[number]["key"]) {
    const url = await buildShareUrl(advertId, platform);
    const text = `Check out ${productName}! 🎉`;
    const links: Record<(typeof PLATFORMS)[number]["key"], string> = {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
      email: `mailto:?subject=${encodeURIComponent(`Check out ${productName}`)}&body=${encodeURIComponent(`${text} ${url}`)}`,
    };
    window.open(links[platform], "_blank", "noopener,noreferrer");
    celebrate(platform);
  }

  async function handleCopy() {
    const url = await buildShareUrl(advertId, "copy");
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-foreground/20 p-3">
      <p className="text-xs font-semibold">📤 Share this ad — spread the word!</p>
      <div className="flex flex-wrap items-center gap-2">
        {canNativeShare && (
          <button
            type="button"
            onClick={handleNativeShare}
            className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-fuchsia-500 to-orange-400 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-transform hover:scale-105"
          >
            {justShared === "native" ? (
              "🎉 Shared!"
            ) : (
              <>
                <ShareGlyph /> Share
              </>
            )}
          </button>
        )}
        {PLATFORMS.map(({ key, label, Icon, className }) => (
          <button
            key={key}
            type="button"
            onClick={() => handlePlatform(key)}
            aria-label={`Share on ${label}`}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-transform hover:scale-105 ${className}`}
          >
            {justShared === key ? "🎉" : <Icon />} {label}
          </button>
        ))}
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-full border border-black/[.08] px-3 py-1.5 text-xs font-medium transition-transform hover:scale-105 dark:border-white/[.145]"
        >
          {copied ? "✅ Copied!" : "🔗 Copy link"}
        </button>
      </div>
    </div>
  );
}
