"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const WORDS = [
  { label: "Salon", href: "/salons" },
  { label: "Beauty", href: "/shops" },
  { label: "Portal", href: "/" },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-black/[.08] bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60 dark:border-white/[.145]">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-center px-6">
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
        </nav>
      </div>
    </header>
  );
}
