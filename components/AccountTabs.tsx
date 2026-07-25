"use client";

import { useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LinkSpinner } from "@/components/LinkSpinner";

export function AccountTabs({
  tabs,
  activeTab,
  adminHref,
}: {
  tabs: readonly { key: string; label: string }[];
  activeTab: string;
  // Admin/staff panel is a separate page, not a same-page tab — rendered in
  // the same pill row (to save the vertical space a standalone banner used
  // to take) but as a plain navigation link instead of a ?tab= switch.
  adminHref?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function go(key: string) {
    if (key === activeTab) return;
    startTransition(() => {
      router.push(`${pathname}?tab=${key}`);
    });
  }

  return (
    <nav className="flex flex-wrap items-center gap-2">
      {tabs.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => go(key)}
          disabled={isPending}
          aria-disabled={isPending}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors disabled:cursor-wait ${
            activeTab === key
              ? "bg-foreground text-background"
              : "border border-black/[.08] hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-white/[.08]"
          }`}
        >
          {label}
        </button>
      ))}
      {adminHref && (
        <Link
          href={adminHref}
          className="flex items-center gap-2 rounded-full border border-dashed border-foreground/30 px-4 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-black/[.04] dark:hover:bg-white/[.08]"
        >
          🛠️ Admin
          <LinkSpinner />
        </Link>
      )}
      {isPending && (
        <span
          role="status"
          aria-label="Loading"
          className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-black/[.08] border-t-foreground dark:border-white/[.145]"
        />
      )}
    </nav>
  );
}
