"use client";

import { useState, useTransition, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function ShopSearchBox({ defaultValue }: { defaultValue?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(defaultValue ?? "");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (value.trim()) {
      params.set("q", value.trim());
    } else {
      params.delete("q");
    }
    params.delete("shopId");
    params.delete("page");
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <label htmlFor="shop-search" className="text-sm font-medium">
        search:
      </label>
      <input
        id="shop-search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search by shop or product name"
        className="flex-1 rounded-full border border-black/[.08] px-4 py-2 text-sm dark:border-white/[.145] dark:bg-transparent"
      />
      <button
        type="submit"
        disabled={isPending}
        aria-disabled={isPending}
        className="rounded-full border border-black/[.08] px-4 py-2 text-sm font-medium hover:bg-black/[.04] disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
      >
        Search
      </button>
    </form>
  );
}
