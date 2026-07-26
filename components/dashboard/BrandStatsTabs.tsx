"use client";

import { useState, type ReactNode } from "react";

type StatsTab = "listings" | "orders" | "revenue";

export function BrandStatsTabs({
  listingsCount,
  ordersCount,
  totalRevenueKes,
  listingsContent,
  ordersContent,
  revenueContent,
}: {
  listingsCount: number;
  ordersCount: number;
  totalRevenueKes: number;
  listingsContent: ReactNode;
  ordersContent: ReactNode;
  revenueContent: ReactNode;
}) {
  const [tab, setTab] = useState<StatsTab>("listings");

  const stats: { key: StatsTab; label: string; value: number }[] = [
    { key: "listings", label: "Listings", value: listingsCount },
    { key: "orders", label: "Store orders", value: ordersCount },
    { key: "revenue", label: "Revenue (Kes)", value: totalRevenueKes },
  ];

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold">Your brand statistics</h2>
      <div className="grid grid-cols-3 gap-3">
        {stats.map(({ key, label, value }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-lg border p-3 text-center transition-colors ${
              tab === key
                ? "border-foreground bg-foreground/[.06] dark:bg-foreground/[.1]"
                : "border-black/[.08] hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-white/[.08]"
            }`}
          >
            <p className="text-lg font-semibold">{value}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
          </button>
        ))}
      </div>

      {tab === "listings" && listingsContent}
      {tab === "orders" && ordersContent}
      {tab === "revenue" && revenueContent}
    </div>
  );
}
