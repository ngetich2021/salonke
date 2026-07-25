import { Suspense } from "react";
import Link from "next/link";
import { auth } from "@/lib/auth";
import {
  CoordinatesSchema,
  PageNumberSchema,
  ResultCountSchema,
  ShopQuerySchema,
} from "@/lib/validations";
import { getNearbyApprovedAdverts, getNearbyShops } from "@/lib/nearest";
import { getOwnedShop } from "@/lib/dashboard";
import { addProductAction } from "@/lib/actions";
import { Panel } from "@/components/Panel";
import { LocationPicker } from "@/components/LocationPicker";
import { ShopSearchBox } from "@/components/ShopSearchBox";
import { ResultCountForm } from "@/components/ResultCountForm";
import { ListPager } from "@/components/ListPager";
import { LinkSpinner } from "@/components/LinkSpinner";
import { AdvertPlayer } from "@/components/AdvertPlayer";
import { ProductTable } from "@/components/ProductTable";
import { SubmitButton } from "@/components/SubmitButton";
import { ContactIcons } from "@/components/ContactIcons";
import { VerifiedBadge } from "@/components/VerifiedBadge";
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

export default async function ShopsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();

  if (session?.user?.role === "BRAND") {
    const shop = await getOwnedShop(session.user.id);
    if (shop) {
      return (
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10">
          <Panel>
            <h1 className="text-lg font-semibold">{shop.name}</h1>
            {shop.phone && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {shop.phone}
              </p>
            )}
          </Panel>

          <Modal triggerLabel="Add product" title="Add a product">
            <form
              action={addProductAction}
              className="flex flex-col gap-3 text-sm"
            >
              <input
                name="name"
                placeholder="Product name"
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
                Add product
              </SubmitButton>
            </form>
          </Modal>

          <ProductTable
            products={shop.products}
            mode="owner"
            searchPlaceholder="Search your products"
            emptyText="No products yet."
          />
        </div>
      );
    }
  }

  const params = await searchParams;
  const coords = CoordinatesSchema.safeParse({ lat: params.lat, lng: params.lng });
  const q = ShopQuerySchema.safeParse(params.q);

  const countParam = Array.isArray(params.count) ? params.count[0] : params.count;
  const countParsed = ResultCountSchema.safeParse(countParam);
  const browsing = countParsed.success;
  const count = browsing ? countParsed.data : 1;

  const results = coords.success
    ? await getNearbyShops(coords.data.lat, coords.data.lng, q.data, count)
    : [];

  const shopIdParam = Array.isArray(params.shopId) ? params.shopId[0] : params.shopId;
  const selected = shopIdParam
    ? (results.find((r) => r.shop.id === shopIdParam) ?? null)
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
    usp.delete("shopId");
    return usp.toString();
  })()}`;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10">
      <LocationPicker />

      {!coords.success && <ShopSearchBox defaultValue={q.data} />}

      {!coords.success && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Pick your location to find the nearest shop.
        </p>
      )}

      {coords.success && results.length === 0 && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">No shop found.</p>
      )}

      {coords.success &&
        results.length > 0 &&
        (showingList ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <ShopSearchBox defaultValue={q.data} />
              <ResultCountForm itemLabel="shops" currentCount={count} idParam="shopId" />
            </div>

            <div className="flex flex-col gap-2">
              {pageResults.map((r) => {
                const usp = toSearchParams(params);
                usp.set("shopId", r.shop.id);
                return (
                  <Link
                    key={r.shop.id}
                    href={`?${usp.toString()}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-black/[.08] bg-white p-4 text-sm shadow-sm transition-colors hover:border-foreground/30 dark:border-white/[.145] dark:bg-zinc-900"
                  >
                    <div>
                      <p className="flex items-center gap-2 font-semibold">
                        {r.shop.name}
                        {r.shop.verified && <VerifiedBadge />}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {r.shop.products.length} product{r.shop.products.length === 1 ? "" : "s"}
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
            <div className="flex flex-col gap-6 rounded-xl border border-black/[.08] bg-zinc-50 p-4 dark:border-white/[.145] dark:bg-zinc-900/40">
              {browsing && (
                <Link
                  href={backToListHref}
                  className="flex items-center gap-2 self-start text-xs font-medium underline"
                >
                  ← Back to list ({results.length} shops)
                  <LinkSpinner />
                </Link>
              )}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <p className="flex items-center gap-2 text-sm">
                    <span className="font-semibold">shop:</span> {selected.shop.name}
                    {selected.shop.verified && <VerifiedBadge />}
                  </p>
                  <ContactIcons tiktokUrl={selected.shop.tiktokUrl} />
                </div>
                <ShopSearchBox defaultValue={q.data} />
                <p className="text-sm">
                  <span className="font-semibold">
                    {selected.isDrivingDistance ? "driving distance:" : "distance:"}
                  </span>{" "}
                  {selected.distanceKm.toFixed(1)} km
                </p>
              </div>

              {!browsing && (
                <ResultCountForm itemLabel="shops" currentCount={null} idParam="shopId" />
              )}

              {!session?.user && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-foreground/20 bg-foreground/[.04] p-3 text-sm">
                  <p className="font-medium">Log in to place an order.</p>
                  <a
                    href={`/login?callbackUrl=${encodeURIComponent(`/shops?${toSearchParams(params).toString()}`)}`}
                    className="rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background"
                  >
                    Log in
                  </a>
                </div>
              )}
              <ProductTable
                products={
                  q.data
                    ? selected.shop.products.filter(
                        (product) =>
                          selected.shop.name.toLowerCase().includes(q.data!.toLowerCase()) ||
                          product.name.toLowerCase().includes(q.data!.toLowerCase())
                      )
                    : selected.shop.products
                }
                mode={session?.user ? "orderable" : "view"}
              />
            </div>
          )
        ))}

      {coords.success && q.data && (
        <Suspense fallback={null}>
          <NearbyAdverts
            lat={coords.data.lat}
            lng={coords.data.lng}
            query={q.data}
            isAuthenticated={!!session?.user}
          />
        </Suspense>
      )}
    </div>
  );
}

async function NearbyAdverts({
  lat,
  lng,
  query,
  isAuthenticated,
}: {
  lat: number;
  lng: number;
  query: string;
  isAuthenticated: boolean;
}) {
  const matchingAdverts = await getNearbyApprovedAdverts(lat, lng, query);
  if (matchingAdverts.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold">Video ads near you</h2>
      <AdvertPlayer
        adverts={matchingAdverts.map(({ advert }) => ({
          id: advert.id,
          videoUrl: advert.videoUrl,
          productName: advert.productName,
          serial: advert.serial,
          phone: advert.phone,
        }))}
        isAuthenticated={isAuthenticated}
      />
    </div>
  );
}
