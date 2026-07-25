"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";

export function AdminStatNav({
  stats,
  activeTab,
}: {
  stats: { key: string; label: string; value: number }[];
  activeTab: string;
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
    <div className="flex flex-col items-center gap-2">
      <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(({ key, label, value }) => (
          <button
            key={key}
            type="button"
            onClick={() => go(key)}
            disabled={isPending}
            aria-disabled={isPending}
            className={`rounded-lg border p-3 text-center transition-colors disabled:cursor-wait ${
              activeTab === key
                ? "border-foreground bg-foreground/[.06] dark:bg-foreground/[.1]"
                : "border-black/[.08] hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-white/[.08]"
            }`}
          >
            <p className="text-lg font-semibold">{value}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
          </button>
        ))}
      </div>
      {isPending && (
        <span
          role="status"
          aria-label="Loading"
          className="h-4 w-4 animate-spin rounded-full border-2 border-black/[.08] border-t-foreground dark:border-white/[.145]"
        />
      )}
    </div>
  );
}
