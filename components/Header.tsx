"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useInstallPrompt } from "@/lib/useInstallPrompt";

const WORDS = [
  { label: "Salon", href: "/salons" },
  { label: "Beauty", href: "/shops" },
  { label: "Portal", href: "/" },
];

export function Header() {
  const pathname = usePathname();
  const { installable, promptInstall } = useInstallPrompt();
  const [hint, setHint] = useState<"ios" | "manual" | null>(null);

  async function handleDownloadClick() {
    const outcome = await promptInstall();
    if (outcome === "ios" || outcome === "manual") {
      setHint((h) => (h === outcome ? null : outcome));
    } else {
      setHint(null);
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-black/[.08] bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60 dark:border-white/[.145]">
      <div className="relative mx-auto flex h-14 max-w-3xl items-center justify-center px-6">
        <nav className="flex items-center gap-1 text-base font-bold">
          {WORDS.map(({ label, href }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`rounded-full px-3 py-1.5 transition-colors ${
                  active
                    ? "bg-foreground text-background"
                    : "hover:bg-black/[.04] dark:hover:bg-white/[.08]"
                }`}
              >
                {label}
              </Link>
            );
          })}
          {installable && (
            <button
              type="button"
              onClick={handleDownloadClick}
              className="rounded-full px-3 py-1.5 transition-colors hover:bg-black/[.04] dark:hover:bg-white/[.08]"
            >
              ⬇ Download
            </button>
          )}
        </nav>

        {hint === "ios" && (
          <div className="absolute top-full right-6 z-10 mt-2 max-w-56 rounded-xl border border-black/[.08] bg-white p-3 text-xs font-normal shadow-lg dark:border-white/[.145] dark:bg-zinc-900">
            Tap <span className="font-semibold">Share</span> in Safari, then{" "}
            <span className="font-semibold">Add to Home Screen</span>.
          </div>
        )}
        {hint === "manual" && (
          <div className="absolute top-full right-6 z-10 mt-2 max-w-56 rounded-xl border border-black/[.08] bg-white p-3 text-xs font-normal shadow-lg dark:border-white/[.145] dark:bg-zinc-900">
            Open your browser menu and choose{" "}
            <span className="font-semibold">Install app</span> (or{" "}
            <span className="font-semibold">Add to Home Screen</span>).
          </div>
        )}
      </div>
    </header>
  );
}
