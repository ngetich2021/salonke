"use client";

import { useState, useTransition, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const DEFAULT_COUNT = 10;
const MAX_COUNT = 50;

// Lets a customer who isn't sold on the single nearest match ask to browse
// more of them instead — they pick a total pool size (e.g. 4, 20), which is
// then fetched nearest-first and shown as a paged list (see ListPager).
// Clears whichever single-item selection param the caller is using
// (shopId/salonId) and any page position, since a new pool invalidates both.
export function ResultCountForm({
  itemLabel,
  currentCount,
  idParam,
}: {
  itemLabel: string;
  currentCount: number | null;
  idParam: "shopId" | "salonId";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(String(currentCount ?? DEFAULT_COUNT));
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const n = Math.max(1, Math.min(MAX_COUNT, Math.trunc(Number(value)) || DEFAULT_COUNT));
    const params = new URLSearchParams(searchParams.toString());
    params.set("count", String(n));
    params.delete(idParam);
    params.delete("page");
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2 text-sm">
      <label htmlFor="result-count" className="text-zinc-600 dark:text-zinc-400">
        {currentCount ? "Browse" : "Not this one? Browse"}
      </label>
      <input
        id="result-count"
        type="number"
        min={1}
        max={MAX_COUNT}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-16 rounded-full border border-black/[.08] px-3 py-1.5 text-sm dark:border-white/[.145] dark:bg-transparent"
      />
      <span className="text-zinc-600 dark:text-zinc-400">{itemLabel}</span>
      <button
        type="submit"
        disabled={isPending}
        aria-disabled={isPending}
        className="rounded-full border border-black/[.08] px-3 py-1.5 font-medium hover:bg-black/[.04] disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/[.145] dark:hover:bg-white/[.08]"
      >
        {isPending ? "Loading…" : "Show"}
      </button>
    </form>
  );
}
