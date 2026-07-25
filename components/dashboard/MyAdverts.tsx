import { getMyAdverts } from "@/lib/dashboard";
import { deleteAdvertAction } from "@/lib/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { DataTable } from "@/components/DataTable";
import { RenewAdvertButton } from "@/components/RenewAdvertButton";
import type { AdvertStatus } from "@/lib/generated/prisma/client";

const STATUS_LABELS: Record<AdvertStatus, string> = {
  PENDING: "Pending review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled by admin",
};

const STATUS_CLASSES: Record<AdvertStatus, string> = {
  PENDING: "text-amber-700 dark:text-amber-400",
  APPROVED: "text-emerald-700 dark:text-emerald-400",
  REJECTED: "text-red-600 dark:text-red-400",
  CANCELLED: "text-red-600 dark:text-red-400",
};

function campaignValue(advert: Awaited<ReturnType<typeof getMyAdverts>>[number]) {
  if (advert.status !== "APPROVED") {
    if (advert.latestPayment?.status === "PENDING") return "Confirming payment";
    if (advert.latestPayment?.status === "FAILED") return "Payment failed";
    return "—";
  }
  if (!advert.campaignExpiresAt) return "—";
  const campaignExpiresAt = new Date(advert.campaignExpiresAt);
  const daysLeft = Math.ceil((campaignExpiresAt.getTime() - Date.now()) / 86_400_000);
  return daysLeft > 0
    ? `${daysLeft}d left, ${advert.repeatCount + 1}x/loop, expires ${campaignExpiresAt.toLocaleDateString()}`
    : `Paused - expired ${campaignExpiresAt.toLocaleDateString()}`;
}

function campaignCell(advert: Awaited<ReturnType<typeof getMyAdverts>>[number]) {
  if (advert.status !== "APPROVED") {
    if (advert.latestPayment?.status === "PENDING") {
      return <span className="text-amber-700 dark:text-amber-400">Confirming payment…</span>;
    }
    if (advert.latestPayment?.status === "FAILED") {
      return <span className="text-red-600 dark:text-red-400">Payment failed</span>;
    }
    return "—";
  }

  if (!advert.campaignExpiresAt) {
    return "—";
  }

  // Coerced via `new Date(...)` rather than trusting the field directly —
  // see the comment on isCampaignLive (lib/campaign.ts) for why a DateTime
  // field can arrive as a plain string despite Prisma's types claiming
  // `Date`. getMyAdverts() itself isn't cached, so this is defensive rather
  // than a known-live bug here, but cheap enough to just always do.
  const campaignExpiresAt = new Date(advert.campaignExpiresAt);
  const daysLeft = Math.ceil((campaignExpiresAt.getTime() - Date.now()) / 86_400_000);
  return (
    <div className="flex flex-col gap-1">
      {daysLeft > 0 ? (
        <span className="text-emerald-700 dark:text-emerald-400">
          {daysLeft}d left · {advert.repeatCount + 1}×/loop
        </span>
      ) : (
        <span className="text-amber-700 dark:text-amber-400">Paused — expired</span>
      )}
      <span className="text-zinc-500 dark:text-zinc-400">
        Expires {campaignExpiresAt.toLocaleDateString()}
      </span>
      <RenewAdvertButton
        advertId={advert.id}
        productName={advert.productName}
        initialPhone={advert.phone}
        initialPackageDays={advert.packageDays ?? 1}
        initialRepeatCount={advert.repeatCount}
      />
    </div>
  );
}

export async function MyAdverts({ ownerId }: { ownerId: string }) {
  const adverts = await getMyAdverts(ownerId);

  return (
    <DataTable
      headers={[
        "No.",
        "Product",
        "Phone",
        "Reach",
        "Searches",
        "Shares",
        "Status",
        "Campaign",
        "Action",
      ]}
      searchPlaceholder="Search your adverts"
      emptyText="You haven't advertised a product yet."
      exportFilename="my-adverts"
      stickyColumns={2}
      stickyColumnWidths={[64, 140]}
      rows={adverts.map((advert) => ({
        key: advert.id,
        searchText: `${advert.serial ?? ""} ${advert.productName} ${advert.status}`,
        cells: [
          advert.serial != null ? `#${advert.serial}` : "—",
          advert.productName,
          advert.phone ?? "—",
          advert.reach === "GLOBAL"
            ? "Showing everywhere"
            : advert.radiusKm
              ? `Within ${advert.radiusKm} km`
              : "Near your location",
          advert.searchCount,
          `${advert._count.shares} (${advert.shareClickCount} reached)`,
          <span key="status" className={`font-semibold ${STATUS_CLASSES[advert.status]}`}>
            {STATUS_LABELS[advert.status]}
          </span>,
          <div key="campaign">{campaignCell(advert)}</div>,
          <form key="action" action={deleteAdvertAction}>
            <input type="hidden" name="advertId" value={advert.id} />
            <SubmitButton
              pendingText="Removing…"
              className="text-xs font-medium text-red-600 underline dark:text-red-400"
            >
              Remove
            </SubmitButton>
          </form>,
        ],
        values: [
          advert.serial != null ? `#${advert.serial}` : "—",
          advert.productName,
          advert.phone ?? "—",
          advert.reach === "GLOBAL"
            ? "Showing everywhere"
            : advert.radiusKm
              ? `Within ${advert.radiusKm} km`
              : "Near your location",
          advert.searchCount,
          `${advert._count.shares} (${advert.shareClickCount} reached)`,
          STATUS_LABELS[advert.status],
          campaignValue(advert),
          "",
        ],
      }))}
    />
  );
}
