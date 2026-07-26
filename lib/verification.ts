import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { Payment } from "@/lib/generated/prisma/client";
import { initiateStkPush } from "@/lib/mpesa";
import { VERIFICATION_FEE_KES } from "@/lib/pricing";
import { VERIFICATION_PERIOD_DAYS } from "@/lib/verification-shared";

export { VERIFICATION_PERIOD_DAYS, isVerificationActive } from "@/lib/verification-shared";

const DAY_MS = 24 * 60 * 60 * 1000;

// Called once a Payment(purpose: VERIFICATION) is confirmed SUCCESS —
// payment IS verification here, no document or admin review step. Flips the
// linked VerificationRequest straight to APPROVED and extends
// verificationExpiresAt by one period on whichever salon/shop it was for,
// in the same transaction, so the badge and the request's own status
// change atomically together. Extends from the current expiry (not from
// now) when it's still in the future, same reasoning as
// activateOrExtendCampaign: an early renewal should never waste days that
// were already paid for and not yet used.
export async function markVerificationPaymentPaid(payment: Payment) {
  if (payment.purpose !== "VERIFICATION") return;

  const request = await prisma.verificationRequest.findUnique({ where: { paymentId: payment.id } });
  if (!request || request.status !== "AWAITING_PAYMENT") return;

  const now = new Date();
  const listing = request.salonId
    ? await prisma.salon.findUnique({ where: { id: request.salonId } })
    : await prisma.shop.findUnique({ where: { id: request.shopId! } });

  const base =
    listing?.verificationExpiresAt && new Date(listing.verificationExpiresAt) > now
      ? new Date(listing.verificationExpiresAt)
      : now;
  const verificationExpiresAt = new Date(base.getTime() + VERIFICATION_PERIOD_DAYS * DAY_MS);
  const data = { verified: true, verifiedAt: listing?.verifiedAt ?? now, verificationExpiresAt };

  await prisma.$transaction([
    prisma.verificationRequest.update({
      where: { id: request.id },
      data: { status: "APPROVED", reviewedAt: now },
    }),
    request.salonId
      ? prisma.salon.update({ where: { id: request.salonId }, data })
      : prisma.shop.update({ where: { id: request.shopId! }, data }),
  ]);

  // getNearbySalons/getNearbyShops (lib/nearest.ts) cache the full listing
  // arrays indefinitely under these tags — without busting them here, a
  // renewal confirmed by this webhook would update the row in the database
  // but the public badge would keep showing whatever verified/expiry state
  // was last cached, same stale-cache trap renewAdCampaignAction had for
  // ad campaigns before that was fixed to revalidate on its own write.
  revalidateTag(request.salonId ? "salons" : "shops", { expire: 0 });
}

// Creates the VerificationRequest + its Payment row together (the request
// needs an already-existing Payment id — see paymentId's @unique FK on
// VerificationRequest) and kicks off the STK push. Same never-throw-on-a-
// failed-push shape as chargeAdCampaign: the Payment row itself records
// FAILED with the reason, and the caller/poller surfaces that, instead of
// rolling back a submission that already created real DB rows.
//
// No document, no review — paying IS the verification (see
// markVerificationPaymentPaid). `documentUrl` stays a required DB column
// (changing that means rebuilding the table on the live SQLite/Turso db,
// not worth it for a field nothing reads anymore) but is just an empty
// string now instead of something collected from the owner.
export async function chargeVerification({
  userId,
  salonId,
  shopId,
  phone,
  listingName,
}: {
  userId: string;
  salonId?: string;
  shopId?: string;
  phone: string;
  listingName: string;
}): Promise<{ paymentId: string }> {
  const amountKes = VERIFICATION_FEE_KES;

  const payment = await prisma.payment.create({
    data: { userId, purpose: "VERIFICATION", amountKes, phone },
  });

  await prisma.verificationRequest.create({
    data: {
      salonId,
      shopId,
      requestedById: userId,
      documentUrl: "",
      phone,
      paymentId: payment.id,
    },
  });

  try {
    const { merchantRequestId, checkoutRequestId } = await initiateStkPush({
      phone,
      amountKes,
      accountReference: `VERIFY-${payment.id.slice(-8)}`,
      transactionDesc: `Verification: ${listingName}`.slice(0, 100),
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
