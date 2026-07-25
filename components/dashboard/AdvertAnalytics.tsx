import { getMyAdverts, getAdvertViewsByDay } from "@/lib/dashboard";
import { DailyBarChart } from "@/components/dashboard/DailyBarChart";

// Per-ad "visitors by day" — visible only to that ad's owner (rendered on
// their own account page), never to other advertisers.
export async function AdvertAnalytics({ ownerId }: { ownerId: string }) {
  const adverts = await getMyAdverts(ownerId);
  if (adverts.length === 0) {
    return (
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        You haven&apos;t advertised a product yet.
      </p>
    );
  }

  const withViews = await Promise.all(
    adverts.map(async (advert) => ({
      advert,
      data: await getAdvertViewsByDay(advert.id, 14),
    }))
  );

  return (
    <div className="flex flex-col gap-5">
      {withViews.map(({ advert, data }) => (
        <DailyBarChart
          key={advert.id}
          title={`${advert.productName} — visitors, last 14 days`}
          data={data}
        />
      ))}
    </div>
  );
}
