import { getMyAdverts } from "@/lib/dashboard";
import { CampaignPerformance } from "@/components/dashboard/CampaignPerformance";

// One "brand portal" panel per live (APPROVED) advert the owner has —
// pending/rejected/cancelled ones stay in the plain MyAdverts table below
// instead, since there's no real performance to show for an ad that isn't
// actually running yet.
export async function CampaignPerformancePanels({ ownerId }: { ownerId: string }) {
  const adverts = await getMyAdverts(ownerId);
  const approved = adverts.filter((advert) => advert.status === "APPROVED");
  if (approved.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {approved.map((advert) => (
        <CampaignPerformance key={advert.id} advertId={advert.id} ownerId={ownerId} />
      ))}
    </div>
  );
}
