import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { haversineKm } from "@/lib/geo";

export async function getCustomerOrders(customerId: string) {
  return prisma.order.findMany({
    where: { customerId },
    include: {
      service: { include: { salon: true } },
      product: { include: { shop: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getBrandOverview(ownerId: string) {
  const [salons, shops] = await Promise.all([
    prisma.salon.findMany({ where: { ownerId }, include: { services: true } }),
    prisma.shop.findMany({ where: { ownerId }, include: { products: true } }),
  ]);

  const serviceIds = salons.flatMap((salon) => salon.services.map((s) => s.id));
  const productIds = shops.flatMap((shop) => shop.products.map((p) => p.id));

  const orConditions: Array<
    { serviceId: { in: string[] } } | { productId: { in: string[] } }
  > = [];
  if (serviceIds.length) orConditions.push({ serviceId: { in: serviceIds } });
  if (productIds.length) orConditions.push({ productId: { in: productIds } });

  const orders = orConditions.length
    ? await prisma.order.findMany({
        where: { OR: orConditions },
        include: {
          customer: true,
          service: { include: { salon: true } },
          product: { include: { shop: true } },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const totalRevenueKes = orders
    .filter((order) => order.status === "COMPLETED")
    .reduce((sum, order) => sum + order.amountKes, 0);

  return { salons, shops, orders, totalRevenueKes };
}

export async function getAdminOverview() {
  const [userCount, salonCount, shopCount, orderCount] = await Promise.all([
    prisma.user.count(),
    prisma.salon.count(),
    prisma.shop.count(),
    prisma.order.count(),
  ]);

  return { userCount, salonCount, shopCount, orderCount };
}

export async function getAllSalons() {
  return prisma.salon.findMany({
    include: { owner: true, services: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAllShops() {
  return prisma.shop.findMany({
    include: { owner: true, products: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAllOrders() {
  return prisma.order.findMany({
    include: {
      customer: true,
      service: { include: { salon: true } },
      product: { include: { shop: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAllUsers() {
  return prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      roleRequests: {
        where: { status: "PENDING" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      customRole: true,
    },
  });
}

export async function getAllCustomRoles() {
  return prisma.customRole.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { users: true } } },
  });
}

export async function getPendingRoleRequest(userId: string) {
  return prisma.roleRequest.findFirst({
    where: { userId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
}

export async function getOwnedSalon(ownerId: string) {
  return prisma.salon.findFirst({
    where: { ownerId },
    include: { services: true },
  });
}

export async function getOwnedShop(ownerId: string) {
  return prisma.shop.findFirst({
    where: { ownerId },
    include: { products: true },
  });
}

// Most recent verification request for a single salon or shop (exactly one
// of the two ids is passed) — powers the account settings verification
// section, which needs to know whether to show the request form, a
// pending/awaiting-payment notice, or a rejection reason.
export async function getLatestVerificationRequest({
  salonId,
  shopId,
}: {
  salonId?: string;
  shopId?: string;
}) {
  return prisma.verificationRequest.findFirst({
    where: salonId ? { salonId } : { shopId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getUserProfile(userId: string) {
  return prisma.user.findUniqueOrThrow({ where: { id: userId } });
}

export async function getMyAdverts(ownerId: string) {
  const [adverts, clicksByAdvert] = await Promise.all([
    prisma.advert.findMany({
      where: { ownerId },
      include: {
        _count: { select: { shares: true } },
        // Most recent AD_CAMPAIGN payment only — enough to show "awaiting
        // payment"/"payment failed, retry" on an unpaid ad in MyAdverts,
        // without pulling the full payment history into this list.
        payments: {
          where: { purpose: "AD_CAMPAIGN" },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.advertShare.groupBy({ by: ["advertId"], _sum: { clickCount: true } }),
  ]);

  const clicksByAdvertId = new Map(
    clicksByAdvert.map((r) => [r.advertId, r._sum.clickCount ?? 0])
  );

  return adverts.map((advert) => ({
    ...advert,
    shareClickCount: clicksByAdvertId.get(advert.id) ?? 0,
    latestPayment: advert.payments[0] ?? null,
  }));
}

// Powers the brand-facing "campaign performance" panel for a single advert:
// all-time impressions (AdvertDailyView, not just the last-14-days window
// shown in the Visits tab), an interest rate (interests / impressions —
// this app's nearest real analog to "click-rate", since "Interested" is the
// only trackable on-ad action), completed-order revenue, and which shops
// products ordered through this ad actually shipped from, distance-ranked
// from the advertiser's own location (same center LOCAL reach uses).
export async function getAdvertCampaignStats(advertId: string, ownerId: string) {
  const [advert, viewsTotal, interestsCount, orders] = await Promise.all([
    prisma.advert.findFirst({ where: { id: advertId, ownerId }, include: { owner: true } }),
    prisma.advertDailyView.aggregate({ where: { advertId }, _sum: { count: true } }),
    prisma.advertInterest.count({ where: { advertId } }),
    prisma.order.findMany({
      where: { advertId },
      include: { product: { include: { shop: true } } },
    }),
  ]);
  if (!advert) return null;

  const impressions = viewsTotal._sum.count ?? 0;
  const interestRate = impressions > 0 ? (interestsCount / impressions) * 100 : 0;
  const completedRevenueKes = orders
    .filter((order) => order.status === "COMPLETED")
    .reduce((sum, order) => sum + order.amountKes, 0);

  const byShop = new Map<
    string,
    { shopId: string; shopName: string; latitude: number; longitude: number; orderCount: number }
  >();
  for (const order of orders) {
    const shop = order.product?.shop;
    if (!shop) continue;
    const entry = byShop.get(shop.id) ?? {
      shopId: shop.id,
      shopName: shop.name,
      latitude: shop.latitude,
      longitude: shop.longitude,
      orderCount: 0,
    };
    entry.orderCount += 1;
    byShop.set(shop.id, entry);
  }

  const attribution = [...byShop.values()]
    .map((s) => ({
      shopId: s.shopId,
      shopName: s.shopName,
      orderCount: s.orderCount,
      distanceKm:
        advert.owner.latitude != null && advert.owner.longitude != null
          ? haversineKm(advert.owner.latitude, advert.owner.longitude, s.latitude, s.longitude)
          : null,
    }))
    .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));

  return {
    advert,
    impressions,
    interestsCount,
    interestRate,
    completedRevenueKes,
    totalOrders: orders.length,
    attribution,
  };
}

// Extends each advert with interest/order/share counts, completed-order
// revenue, and total share-link click-throughs ("shared fully") for the
// admin campaign-effectiveness view — same revenue-from-COMPLETED-orders
// convention as getBrandOverview's totalRevenueKes above.
export async function getAllAdverts() {
  const [adverts, revenueByAdvert, clicksByAdvert] = await Promise.all([
    prisma.advert.findMany({
      include: {
        owner: true,
        _count: { select: { interests: true, orders: true, shares: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.order.groupBy({
      by: ["advertId"],
      where: { advertId: { not: null }, status: "COMPLETED" },
      _sum: { amountKes: true },
    }),
    prisma.advertShare.groupBy({ by: ["advertId"], _sum: { clickCount: true } }),
  ]);

  const revenueByAdvertId = new Map(
    revenueByAdvert.map((r) => [r.advertId as string, r._sum.amountKes ?? 0])
  );
  const clicksByAdvertId = new Map(
    clicksByAdvert.map((r) => [r.advertId, r._sum.clickCount ?? 0])
  );

  return adverts.map((advert) => ({
    ...advert,
    orderRevenueKes: revenueByAdvertId.get(advert.id) ?? 0,
    shareClickCount: clicksByAdvertId.get(advert.id) ?? 0,
  }));
}

// Every M-Pesa payment attempt (ad campaigns + verification fees), newest
// first — powers the admin "Payments" tab. Only SUCCESS rows count toward
// money actually received; PENDING/FAILED stay visible so an admin can spot
// a stuck or bounced STK push.
export async function getAllPayments() {
  return prisma.payment.findMany({
    include: { user: true, advert: true },
    orderBy: { createdAt: "desc" },
  });
}

// Sorted PENDING-first (what actually needs an admin decision right now),
// then AWAITING_PAYMENT, then already-resolved ones — plain alphabetical
// order on the status string wouldn't give that priority, so it's sorted in
// JS instead of the query itself.
const VERIFICATION_STATUS_PRIORITY: Record<string, number> = {
  PENDING: 0,
  AWAITING_PAYMENT: 1,
  APPROVED: 2,
  REJECTED: 2,
};

export async function getAllVerificationRequests() {
  const requests = await prisma.verificationRequest.findMany({
    include: { salon: true, shop: true, requestedBy: true },
    orderBy: { createdAt: "desc" },
  });
  return [...requests].sort(
    (a, b) => VERIFICATION_STATUS_PRIORITY[a.status] - VERIFICATION_STATUS_PRIORITY[b.status]
  );
}

// Anonymous-friendly issue reports (see submitIssueReportAction) — sorted
// open-first so the admin queue always leads with what's unresolved, newest
// of each group first.
export async function getAllIssueReports() {
  return prisma.issueReport.findMany({
    include: { reporter: true },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
}

// Rendered on every single page load (the global ad reel in layout.tsx), so
// it's cached indefinitely and only ever refetched when adminSetAdvertStatusAction
// or deleteAdvertAction touches the "approved-adverts" tag — avoids a
// database round-trip on every page view for data that only changes when an
// admin acts.
export const getApprovedAdverts = unstable_cache(
  async () => {
    return prisma.advert.findMany({
      where: { status: "APPROVED" },
      orderBy: { createdAt: "desc" },
    });
  },
  ["approved-adverts"],
  { tags: ["approved-adverts"] }
);

// UTC calendar dates for the trailing `days` window, oldest first — the
// shared x-axis for both daily-visit queries below, so callers get an
// explicit zero for any day with no recorded activity instead of a gap.
function trailingUtcDates(days: number) {
  const today = new Date();
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - (days - 1 - i)));
    return d.toISOString().slice(0, 10);
  });
}

// Site-wide page visits by day — admin-only (see AGENTS.md task: restricted
// to admin, not the general staff CustomRole permissions).
export async function getSiteVisitsByDay(days = 14) {
  const dates = trailingUtcDates(days);
  const rows = await prisma.dailyVisit.findMany({ where: { date: { in: dates } } });
  const countByDate = new Map(rows.map((r) => [r.date, r.count]));
  return dates.map((date) => ({ date, count: countByDate.get(date) ?? 0 }));
}

// Visits-while-showing by day for a single advert — shown only to that
// advert's owner (and admins), never other advertisers.
export async function getAdvertViewsByDay(advertId: string, days = 14) {
  const dates = trailingUtcDates(days);
  const rows = await prisma.advertDailyView.findMany({ where: { advertId, date: { in: dates } } });
  const countByDate = new Map(rows.map((r) => [r.date, r.count]));
  return dates.map((date) => ({ date, count: countByDate.get(date) ?? 0 }));
}
