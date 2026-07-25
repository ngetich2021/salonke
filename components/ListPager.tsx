"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Pages a results list 5-at-a-time via a `page` query param — the list
// itself is already fetched and ranked nearest-first server-side; this only
// moves the window over it, so it never refetches from the network.
export function ListPager({ page, totalPages }: { page: number; totalPages: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  if (totalPages <= 1) return null;

  function go(newPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(newPage));
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <button
        type="button"
        onClick={() => go(page - 1)}
        disabled={page <= 1 || isPending}
        className="rounded-full border border-black/[.08] px-3 py-1.5 font-medium disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[.145]"
      >
        ← Prev
      </button>
      <span className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
        {isPending && (
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-black/[.08] border-t-foreground dark:border-white/[.145]" />
        )}
        Page {page} of {totalPages}
      </span>
      <button
        type="button"
        onClick={() => go(page + 1)}
        disabled={page >= totalPages || isPending}
        className="rounded-full border border-black/[.08] px-3 py-1.5 font-medium disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[.145]"
      >
        Next →
      </button>
    </div>
  );
}
