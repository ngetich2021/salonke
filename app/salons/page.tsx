import Link from "next/link";
import { auth } from "@/lib/auth";
import { CoordinatesSchema, PageNumberSchema, ResultCountSchema } from "@/lib/validations";
import { getNearbySalons } from "@/lib/nearest";
import { getOwnedSalon } from "@/lib/dashboard";
import { addServiceAction } from "@/lib/actions";
import { Panel } from "@/components/Panel";
import { LocationPicker } from "@/components/LocationPicker";
import { SalonCard } from "@/components/SalonCard";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { isVerificationActive } from "@/lib/verification";
import { ResultCountForm } from "@/components/ResultCountForm";
import { ListPager } from "@/components/ListPager";
import { LinkSpinner } from "@/components/LinkSpinner";
import { ServiceTable } from "@/components/ServiceTable";
import { SubmitButton } from "@/components/SubmitButton";
import { Modal } from "@/components/Modal";
import { ImageFileInput } from "@/components/ImageFileInput";

const LIST_PAGE_SIZE = 5;

function toSearchParams(params: { [key: string]: string | string[] | undefined }) {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      if (value[0] !== undefined) usp.set(key, value[0]);
    } else if (value !== undefined) {
      usp.set(key, value);
    }
  }
  return usp;
}

export default async function SalonsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();

  if (session?.user?.role === "BRAND") {
    const salon = await getOwnedSalon(session.user.id);
    if (salon) {
      return (
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10">
          <Panel>
            <h1 className="text-lg font-semibold">
              {salon.name}
              {isVerificationActive(salon) && <VerifiedBadge />}
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {salon.centreName} • {salon.phone}
            </p>
          </Panel>

          <Modal triggerLabel="Add service" title="Add a service">
            <form
              action={addServiceAction}
              className="flex flex-col gap-3 text-sm"
            >
              <input
                name="name"
                placeholder="Service name"
                required
                className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-transparent"
              />
              <textarea
                name="description"
                placeholder="Description"
                required
                className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-transparent"
              />
              <input
                name="priceKes"
                type="number"
                min="1"
                placeholder="Price (Kes)"
                required
                className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-transparent"
              />
              <ImageFileInput />
              <SubmitButton
                pendingText="Adding…"
                className="self-start rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background"
              >
                Add service
              </SubmitButton>
            </form>
          </Modal>

          <ServiceTable
            services={salon.services}
            mode="owner"
            searchPlaceholder="Search your services"
            emptyText="No services yet."
          />
        </div>
      );
    }
  }

  const params = await searchParams;
  const coords = CoordinatesSchema.safeParse({ lat: params.lat, lng: params.lng });

  const countParam = Array.isArray(params.count) ? params.count[0] : params.count;
  const countParsed = ResultCountSchema.safeParse(countParam);
  const browsing = countParsed.success;
  const count = browsing ? countParsed.data : 1;

  const results = coords.success
    ? await getNearbySalons(coords.data.lat, coords.data.lng, count)
    : [];

  const salonIdParam = Array.isArray(params.salonId) ? params.salonId[0] : params.salonId;
  const selected = salonIdParam
    ? (results.find((r) => r.salon.id === salonIdParam) ?? null)
    : browsing
      ? null
      : (results[0] ?? null);
  const showingList = browsing && !selected;

  const pageParam = Array.isArray(params.page) ? params.page[0] : params.page;
  const pageParsed = PageNumberSchema.safeParse(pageParam);
  const totalPages = Math.max(1, Math.ceil(results.length / LIST_PAGE_SIZE));
  const page = Math.min(pageParsed.success ? pageParsed.data : 1, totalPages);
  const pageResults = results.slice((page - 1) * LIST_PAGE_SIZE, page * LIST_PAGE_SIZE);

  const backToListHref = `?${(() => {
    const usp = toSearchParams(params);
    usp.delete("salonId");
    return usp.toString();
  })()}`;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10">
      <LocationPicker />

      {!coords.success && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Pick your location to find the nearest salon.
        </p>
      )}

      {coords.success && results.length === 0 && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No salons available yet.
        </p>
      )}

      {coords.success &&
        results.length > 0 &&
        (showingList ? (
          <div className="flex flex-col gap-4">
            <ResultCountForm itemLabel="salons" currentCount={count} idParam="salonId" />

            <div className="flex flex-col gap-2">
              {pageResults.map((r) => {
                const usp = toSearchParams(params);
                usp.set("salonId", r.salon.id);
                return (
                  <Link
                    key={r.salon.id}
                    href={`?${usp.toString()}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-black/[.08] bg-white p-4 text-sm shadow-sm transition-colors hover:border-foreground/30 dark:border-white/[.145] dark:bg-zinc-900"
                  >
                    <div>
                      <p className="font-semibold">
                        {r.salon.name}
                        {isVerificationActive(r.salon) && <VerifiedBadge />}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {r.salon.centreName} • {r.salon.services.length} service
                        {r.salon.services.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                      {r.isDrivingDistance ? "" : "~"}
                      {r.distanceKm.toFixed(1)} km
                      <LinkSpinner />
                    </span>
                  </Link>
                );
              })}
            </div>

            <ListPager page={page} totalPages={totalPages} />
          </div>
        ) : (
          selected && (
            <>
              {browsing && (
                <Link
                  href={backToListHref}
                  className="flex items-center gap-2 self-start text-xs font-medium underline"
                >
                  ← Back to list ({results.length} salons)
                  <LinkSpinner />
                </Link>
              )}
              <SalonCard
                salon={selected.salon}
                distanceKm={selected.distanceKm}
                isDrivingDistance={selected.isDrivingDistance}
              />
              {!browsing && (
                <ResultCountForm itemLabel="salons" currentCount={null} idParam="salonId" />
              )}
              {!session?.user && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-foreground/20 bg-foreground/[.04] p-3 text-sm">
                  <p className="font-medium">Log in to place an order.</p>
                  <a
                    href={`/login?callbackUrl=${encodeURIComponent(`/salons?${toSearchParams(params).toString()}`)}`}
                    className="rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background"
                  >
                    Log in
                  </a>
                </div>
              )}
              <ServiceTable
                services={selected.salon.services}
                mode={session?.user ? "orderable" : "view"}
              />
            </>
          )
        ))}
    </div>
  );
}
