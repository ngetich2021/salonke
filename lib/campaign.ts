import { prisma } from "@/lib/prisma";
import type { Advert, Payment } from "@/lib/generated/prisma/client";
import { initiateStkPush } from "@/lib/mpesa";
import { adCampaignTotalKes } from "@/lib/pricing";

const DAY_MS = 24 * 60 * 60 * 1000;

// Creates the Payment row for an ad campaign (new submission or renewal) and
// kicks off the STK push. Shared by createAdvertAction (first payment) and
// renewAdCampaignAction (later ones) — both just point it at an
// already-existing Advert with packageDays/repeatCount already set to the
// terms being paid for. Never throws on a failed STK push — the Payment row
// itself records FAILED with the reason, and the caller/poller surfaces
// that, since a submission that already created real DB rows shouldn't be
// rolled back just because the phone-side push didn't go out.
export async function chargeAdCampaign({
  advertId,
  userId,
  phone,
  packageDays,
  repeatCount,
  productName,
}: {
  advertId: string;
  userId: string;
  phone: string;
  packageDays: number;
  repeatCount: number;
  productName: string;
}): Promise<{ paymentId: string }> {
  const amountKes = adCampaignTotalKes(packageDays, repeatCount);

  const payment = await prisma.payment.create({
    data: { userId, purpose: "AD_CAMPAIGN", amountKes, phone, advertId },
  });

  try {
    const { merchantRequestId, checkoutRequestId } = await initiateStkPush({
      phone,
      amountKes,
      accountReference: `AD-${advertId.slice(-8)}`,
      transactionDesc: `Ad campaign: ${productName}`.slice(0, 100),
    });
    await prisma.payment.update({
      where: { id: payment.id },
      data: { merchantRequestId, checkoutRequestId },
    });
  } catch (err) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "FAILED",
        resultDesc: err instanceof Error ? err.message : "Failed to start payment",
      },
    });
  }

  return { paymentId: payment.id };
}

// Called once a Payment(purpose: AD_CAMPAIGN) is confirmed SUCCESS.
//
// The paid "clock" only ever starts once the advert has been APPROVED — not
// at payment time — so a slow admin review queue never eats into paid days.
// If the advert is still PENDING (a brand-new submission awaiting its first
// review), this is a no-op: adminSetAdvertStatusAction starts the clock
// itself the moment it approves an advert with an unconsumed successful
// payment. If the advert is already APPROVED, this is either the first
// payment landing after approval, or a renewal — either way, extend from
// whichever is later: now, or the current expiry (so an early renewal never
// wastes days that were already paid for and not yet used).
export async function activateOrExtendCampaign(advert: Advert, payment: Payment) {
  if (advert.status !== "APPROVED" || payment.purpose !== "AD_CAMPAIGN" || !payment.advertId) {
    return;
  }

  const packageDays = advert.packageDays ?? 0;
  const now = new Date();
  const base =
    advert.campaignStartsAt && advert.campaignExpiresAt && advert.campaignExpiresAt > now
      ? advert.campaignExpiresAt
      : now;

  await prisma.advert.update({
    where: { id: advert.id },
    data: {
      campaignStartsAt: advert.campaignStartsAt ?? now,
      campaignExpiresAt: new Date(base.getTime() + packageDays * DAY_MS),
    },
  });
}

// An advert with no campaignExpiresAt at all is grandfathered (created
// before paid campaigns existed, or never had a package attached) and shows
// indefinitely. Everything else "pauses" — drops out of rotation — the
// moment its paid package runs out, without changing AdvertStatus at all.
//
// Coerces via `new Date(...)` rather than comparing the field directly:
// this is called on data from getApprovedAdverts()/getApprovedAdvertsWithOwner
// (lib/dashboard.ts, lib/nearest.ts), both wrapped in `unstable_cache` —
// which JSON-serializes its cached return value, silently flattening every
// Date field to a plain ISO string with no automatic revival on read. The
// Prisma-generated types still claim `Date`, so without this coercion
// `campaignExpiresAt > new Date()` silently compares a string to a Date
// (via NaN) and is always false, which is what made every paid, non-expired
// campaign look expired and get filtered out of rotation entirely.
export function isCampaignLive(advert: { campaignExpiresAt: Date | null }): boolean {
  if (advert.campaignExpiresAt == null) return true;
  return new Date(advert.campaignExpiresAt) > new Date();
}

// Minimum number of *other* live ads that must play between two occurrences
// of the same ad in one rotation loop — e.g. 3 means a repeated ad's plays
// land at least 4 slots apart: y,1,2,3,y,4,5,6,y,7,8,9,y,10, then the loop
// repeats. Only relaxed (see buildSpacedCycle below) when there simply
// aren't enough *other* distinct live ads to fill the gap — the one
// invariant that's never relaxed is that the same ad never plays twice in a
// row, which is always achievable as long as 2+ distinct ads are live.
const MIN_OTHER_ADS_BETWEEN_REPEATS = 3;

// Expands a list of live adverts into one rotation cycle, weighted by
// repeatCount + 1 (so a paid repeat actually shows up more often per loop)
// and spaced so repeats of the same ad never land back-to-back. Each advert
// with weight w appears exactly w times in the returned cycle.
export function weightedAdRotation<
  T extends { id: string; repeatCount: number; campaignExpiresAt: Date | null },
>(adverts: T[]): T[] {
  const live = adverts.filter(isCampaignLive);
  if (live.length === 0) return [];
  if (live.length === 1) {
    // Nothing else live to interleave with — repeats of the only ad are
    // necessarily consecutive, no matter the algorithm.
    return Array.from({ length: live[0].repeatCount + 1 }, () => live[0]);
  }

  return buildSpacedCycle(
    live.map((advert) => ({ advert, weight: advert.repeatCount + 1 })),
    MIN_OTHER_ADS_BETWEEN_REPEATS
  );
}

// Places each entry's occurrences so repeats of the same ad land at least
// `minGap` other ads apart, gracefully shrinking that gap — down to "just
// never adjacent" — only where there aren't enough other distinct ads to
// fill it. Same idea as the classic "rearrange items so identical ones are
// k apart" scheduling problem (cooldown-based, à la task-scheduler /
// LeetCode 358): each entry goes back on cooldown for `minGap + 1` slots
// after it plays, and among whatever's off cooldown, the entry with the
// most remaining occurrences goes next — that's what makes a heavily
// repeated ad claim slots as soon as they open up instead of clumping at
// one end of the loop.
function buildSpacedCycle<T extends { id: string }>(
  entries: { advert: T; weight: number }[],
  minGap: number
): T[] {
  const minDistance = minGap + 1;
  const total = entries.reduce((sum, e) => sum + e.weight, 0);
  const state = entries.map((e, order) => ({
    advert: e.advert,
    weight: e.weight,
    remaining: e.weight,
    availableAt: 0,
    order,
  }));

  const result: T[] = [];
  let lastId: string | null = null;

  for (let t = 0; t < total; t++) {
    const ready = state.filter((s) => s.remaining > 0 && s.availableAt <= t);
    const pool = ready.length > 0 ? ready : state.filter((s) => s.remaining > 0);
    // Never repeat the immediately preceding ad while any alternative exists.
    const candidates = pool.filter((s) => s.advert.id !== lastId);
    const from = candidates.length > 0 ? candidates : pool;

    const pick = from.reduce((best, s) => {
      if (s.remaining !== best.remaining) return s.remaining > best.remaining ? s : best;
      if (s.weight !== best.weight) return s.weight > best.weight ? s : best;
      return s.order < best.order ? s : best;
    });

    result.push(pick.advert);
    pick.remaining -= 1;
    pick.availableAt = t + minDistance;
    lastId = pick.advert.id;
  }

  // The greedy pass above only reasons about a linear sequence, so it can
  // still leave adjacent duplicates behind in two cases: the loop repeats
  // immediately after its own last slot (the seam between last and first is
  // "adjacent" too, which the linear pass never sees), and — for weight
  // combinations where one ad's weight sits close to half the total across
  // few distinct ads — a duplicate pair stranded mid-cycle since the greedy
  // choice at each step doesn't look ahead. Repair those with a small local
  // search: swap or relocate one slot at a time, keeping any move that
  // reduces the total number of adjacent same-ad pairs.
  fixAdjacentPairs(result);

  return result;
}

function countAdjacentPairs<T extends { id: string }>(result: T[]): number {
  const total = result.length;
  let count = 0;
  for (let i = 0; i < total; i++) {
    if (result[i].id === result[(i + 1) % total].id) count += 1;
  }
  return count;
}

// Local search over single-slot moves: as long as at least one adjacent
// same-ad pair remains, try swapping or relocating (remove one slot, reinsert
// it elsewhere) one side of an actual clash and keep the first move found
// that strictly reduces the total adjacent-pair count. Swaps alone can get
// stuck — two slots can each be blocked from swapping because it would
// create a *new* clash on the other side, even though relocating one of them
// a few slots further along resolves it cleanly. Only the clashing slots
// themselves are ever picked as the thing being moved (there are usually
// only a handful, regardless of how large the full cycle is) — that keeps
// this cheap even for a large rotation, since scanning every slot as a
// candidate mover would be cubic in the cycle length. Bounded by iterations
// so a pathological input can't hang a request; the invariant that matters
// (no back-to-back repeat of the same ad) is usually reached well before the
// bound, and shrinking the gap further is a best-effort improvement, not a
// guarantee.
function fixAdjacentPairs<T extends { id: string }>(result: T[]): void {
  const total = result.length;
  if (total < 3) return;

  const maxIterations = 200;
  for (let guard = 0; guard < maxIterations; guard++) {
    const before = countAdjacentPairs(result);
    if (before === 0) return;

    const clashPositions = new Set<number>();
    for (let i = 0; i < total; i++) {
      if (result[i].id === result[(i + 1) % total].id) {
        clashPositions.add(i);
        clashPositions.add((i + 1) % total);
      }
    }

    let improved = false;
    outer: for (const a of clashPositions) {
      for (let b = 0; b < total; b++) {
        if (a === b) continue;

        [result[a], result[b]] = [result[b], result[a]];
        if (countAdjacentPairs(result) < before) {
          improved = true;
          break outer;
        }
        [result[a], result[b]] = [result[b], result[a]]; // revert

        const [item] = result.splice(a, 1);
        const insertAt = a < b ? b - 1 : b;
        result.splice(insertAt, 0, item);
        if (countAdjacentPairs(result) < before) {
          improved = true;
          break outer;
        }
        result.splice(insertAt, 1);
        result.splice(a, 0, item); // revert
      }
    }

    if (!improved) return; // local optimum — further gap-narrowing isn't possible
  }
}
