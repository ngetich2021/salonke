import { getAdvertCampaignStats } from "@/lib/dashboard";

// A dressed-up "brand portal" view of a single live campaign — real numbers
// throughout (no fabricated ad-spend/ROAS figure, since this app has no
// budget or payment system to compute that against): all-time impressions,
// an interest rate (this app's actual on-ad action, standing in for
// click-rate), completed-order revenue, and which shops nearby actually
// sold something because of this ad.
export async function CampaignPerformance({
  advertId,
  ownerId,
}: {
  advertId: string;
  ownerId: string;
}) {
  const stats = await getAdvertCampaignStats(advertId, ownerId);
  if (!stats) return null;

  const { advert, impressions, interestRate, completedRevenueKes, attribution } = stats;

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-700 bg-black font-mono text-sm text-zinc-100 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-700 px-4 py-3">
        <span>
          🏪 <span className="font-semibold tracking-wide">BRAND PORTAL</span>{" "}
          <span className="text-zinc-400">[ {advert.productName} ]</span>
        </span>
        <span className="text-emerald-400">[ Campaign Active ]</span>
      </div>

      <div className="flex flex-col gap-3 border-b border-zinc-700 px-4 py-3">
        <p className="text-zinc-400">
          📈 CAMPAIGN PERFORMANCE ({advert.productName.toUpperCase()} AD)
        </p>
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded border border-zinc-700 bg-zinc-700 sm:grid-cols-3">
          <div className="flex flex-col items-center gap-1 bg-black px-3 py-4">
            <span className="text-xs text-zinc-400">IMPRESSIONS</span>
            <span className="text-lg font-semibold">{impressions.toLocaleString()}</span>
          </div>
          <div className="flex flex-col items-center gap-1 bg-black px-3 py-4">
            <span className="text-xs text-zinc-400">INTEREST RATE</span>
            <span className="text-lg font-semibold">{interestRate.toFixed(1)}%</span>
          </div>
          <div className="flex flex-col items-center gap-1 bg-black px-3 py-4">
            <span className="text-xs text-zinc-400">REVENUE</span>
            <span className="text-lg font-semibold">Kes {completedRevenueKes.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-b border-zinc-700 px-4 py-3">
        <p className="text-zinc-400">📍 LOCAL INVENTORY &amp; ATTRIBUTION</p>
        {attribution.length === 0 ? (
          <p className="text-xs text-zinc-500">No sales attributed to this ad yet.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-xs">
            {attribution.map((a) => (
              <li key={a.shopId}>
                • {a.shopName}
                {a.distanceKm != null && ` (${a.distanceKm.toFixed(1)}km away)`}: {a.orderCount} order
                {a.orderCount === 1 ? "" : "s"} driven by this ad
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-end px-4 py-3">
        <a
          href="?tab=visits"
          className="font-mono text-xs text-zinc-400 hover:text-zinc-200"
        >
          [ Daily analytics ]
        </a>
      </div>
    </div>
  );
}
