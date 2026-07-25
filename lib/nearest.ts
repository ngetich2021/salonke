import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getDrivingDistanceKm, haversineKm } from "@/lib/geo";
import { isCampaignLive } from "@/lib/campaign";

// Raw table fetches shared by the nearest-salon/shop lookups below (and, for
// shops, the advert-to-shop matcher) — cached because they're identical for
// every visitor regardless of their location or search query; only the
// ranking/filtering that runs over them afterward is request-specific.
// Invalidated by the "salons"/"shops" tags whenever a listing, service, or
// product is added/edited/removed (see lib/actions.ts).
const getAllSalonsWithServices = unstable_cache(
  async () => prisma.salon.findMany({ include: { services: true } }),
  ["salons-with-services"],
  { tags: ["salons"] }
);

const getAllShopsWithProducts = unstable_cache(
  async () => prisma.shop.findMany({ include: { products: true } }),
  ["shops-with-products"],
  { tags: ["shops"] }
);

const getApprovedAdvertsWithOwner = unstable_cache(
  async () => prisma.advert.findMany({ where: { status: "APPROVED" }, include: { owner: true } }),
  ["approved-adverts-with-owner"],
  { tags: ["approved-adverts"] }
);

// Straight-line distance alone can rank a place as "nearest" when it's
// actually far by road (river, highway, no direct route). Re-rank the
// closest few candidates by real driving distance so the order reflects
// what's actually quickest to reach, not just closest as the crow flies.
// Capped independently of the caller's requested `limit` (customers can ask
// for up to MAX_RESULT_LIMIT results): the driving-distance lookup hits a
// free, unauthenticated public routing server, and firing off one request
// per candidate for a large pool risks getting rate-limited or blocked.
// Candidates beyond this cap keep their straight-line ordering instead —
// still correctly sorted, just not road-accurate that far out.
const DRIVING_RERANK_LIMIT = 10;

export const MAX_RESULT_LIMIT = 50;

async function rankNearest<T>(
  items: T[],
  lat: number,
  lng: number,
  getCoords: (item: T) => { latitude: number; longitude: number },
  limit: number
): Promise<{ item: T; distanceKm: number; isDrivingDistance: boolean }[]> {
  const byStraightLine = items
    .map((item) => {
      const { latitude, longitude } = getCoords(item);
      return { item, straightKm: haversineKm(lat, lng, latitude, longitude) };
    })
    .sort((a, b) => a.straightKm - b.straightKm)
    .slice(0, Math.max(1, Math.min(limit, MAX_RESULT_LIMIT)));

  const toRerank = byStraightLine.slice(0, DRIVING_RERANK_LIMIT);
  const straightLineTail = byStraightLine.slice(DRIVING_RERANK_LIMIT);

  const reranked = await Promise.all(
    toRerank.map(async (candidate) => {
      const { latitude, longitude } = getCoords(candidate.item);
      const drivingKm = await getDrivingDistanceKm(lat, lng, latitude, longitude);
      return { ...candidate, drivingKm };
    })
  );

  const rerankedSorted = reranked
    .sort((a, b) => (a.drivingKm ?? a.straightKm) - (b.drivingKm ?? b.straightKm))
    .map((r) => ({
      item: r.item,
      distanceKm: r.drivingKm ?? r.straightKm,
      isDrivingDistance: r.drivingKm != null,
    }));

  const tailMapped = straightLineTail.map((r) => ({
    item: r.item,
    distanceKm: r.straightKm,
    isDrivingDistance: false,
  }));

  return [...rerankedSorted, ...tailMapped];
}

export async function getNearbySalons(lat: number, lng: number, limit = 1) {
  const salons = await getAllSalonsWithServices();
  const withServices = salons.filter((salon) => !salon.suspended && salon.services.length > 0);
  if (withServices.length === 0) return [];

  const ranked = await rankNearest(
    withServices,
    lat,
    lng,
    (salon) => ({ latitude: salon.latitude, longitude: salon.longitude }),
    limit
  );

  return ranked.map((r) => ({
    salon: r.item,
    distanceKm: r.distanceKm,
    isDrivingDistance: r.isDrivingDistance,
  }));
}

export async function getNearbyShops(lat: number, lng: number, query?: string, limit = 1) {
  const shops = await getAllShopsWithProducts();
  const q = query?.toLowerCase();
  const filtered = (q
    ? shops.filter(
        (shop) =>
          shop.name.toLowerCase().includes(q) ||
          shop.products.some((product) => product.name.toLowerCase().includes(q))
      )
    : shops
  ).filter((shop) => !shop.suspended && shop.products.length > 0);
  if (filtered.length === 0) return [];

  const ranked = await rankNearest(
    filtered,
    lat,
    lng,
    (shop) => ({ latitude: shop.latitude, longitude: shop.longitude }),
    limit
  );

  return ranked.map((r) => ({
    shop: r.item,
    distanceKm: r.distanceKm,
    isDrivingDistance: r.isDrivingDistance,
  }));
}

// Approved video ads aren't tied to a shop. LOCAL ads are ranked by
// straight-line distance from the advertiser's own location (and dropped if
// outside their chosen radius); GLOBAL ads match any search anywhere and
// carry no distance. LOCAL matches are returned first, nearest first.
export async function getNearbyApprovedAdverts(lat: number, lng: number, query: string) {
  const q = query.toLowerCase();
  const adverts = await getApprovedAdvertsWithOwner();

  const matching = adverts.filter(
    (advert) =>
      isCampaignLive(advert) &&
      (advert.productName.toLowerCase().includes(q) ||
        (advert.description?.toLowerCase().includes(q) ?? false))
  );

  const localMatches = matching
    .filter(
      (advert) =>
        advert.reach === "LOCAL" &&
        advert.owner.latitude != null &&
        advert.owner.longitude != null
    )
    .map((advert) => ({
      advert,
      distanceKm: haversineKm(lat, lng, advert.owner.latitude!, advert.owner.longitude!),
    }))
    .filter((entry) => entry.advert.radiusKm == null || entry.distanceKm <= entry.advert.radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  const globalMatches = matching
    .filter((advert) => advert.reach === "GLOBAL")
    .map((advert) => ({ advert, distanceKm: null as number | null }));

  const results = [...localMatches, ...globalMatches];

  if (results.length > 0) {
    await prisma.advert.updateMany({
      where: { id: { in: results.map((r) => r.advert.id) } },
      data: { searchCount: { increment: 1 } },
    });
  }

  return results;
}

function productMatchesAdvert(
  product: { name: string; description: string },
  advert: { productName: string; description: string | null }
): boolean {
  const productName = product.name.toLowerCase();
  const productDesc = product.description.toLowerCase();
  const advertName = advert.productName.toLowerCase();
  const advertDesc = advert.description?.toLowerCase() ?? "";

  return (
    productName.includes(advertName) ||
    advertName.includes(productName) ||
    productDesc.includes(advertName) ||
    (advertDesc.length > 0 &&
      (productName.includes(advertDesc) || advertDesc.includes(productName)))
  );
}

// Given a video ad, find shops whose products match its name/description —
// GLOBAL ads match any shop anywhere; LOCAL ads with a radius are scoped to
// shops within that radius of the advertiser's own location (same center
// used to gate ad visibility). Viewer coordinates, when known, are used
// only to sort matches nearest-first, never to filter them.
export async function getShopsForAdvert(
  advertId: string,
  lat: number | null,
  lng: number | null
) {
  const advert = await prisma.advert.findFirst({
    where: { id: advertId, status: "APPROVED" },
    include: { owner: true },
  });
  if (!advert) return { advert: null, matches: [] };

  const shops = await getAllShopsWithProducts();

  const candidates = shops.flatMap((shop) => {
    if (shop.suspended) return [];
    const product = shop.products.find((p) => productMatchesAdvert(p, advert));
    return product ? [{ shop, product }] : [];
  });

  const scoped =
    advert.reach === "LOCAL" &&
    advert.radiusKm != null &&
    advert.owner.latitude != null &&
    advert.owner.longitude != null
      ? candidates.filter(
          (c) =>
            haversineKm(
              advert.owner.latitude!,
              advert.owner.longitude!,
              c.shop.latitude,
              c.shop.longitude
            ) <= advert.radiusKm!
        )
      : candidates;

  const withDistance = scoped.map((c) => ({
    shop: c.shop,
    product: c.product,
    distanceKm: lat != null && lng != null ? haversineKm(lat, lng, c.shop.latitude, c.shop.longitude) : null,
  }));

  withDistance.sort((a, b) => {
    if (a.distanceKm == null && b.distanceKm == null) return 0;
    if (a.distanceKm == null) return 1;
    if (b.distanceKm == null) return -1;
    return a.distanceKm - b.distanceKm;
  });

  return { advert, matches: withDistance };
}
