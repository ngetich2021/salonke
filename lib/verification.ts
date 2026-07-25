import { prisma } from "@/lib/prisma";
import type { Payment } from "@/lib/generated/prisma/client";
import { initiateStkPush } from "@/lib/mpesa";
import { VERIFICATION_FEE_KES } from "@/lib/pricing";

// Called once a Payment(purpose: VERIFICATION) is confirmed SUCCESS —
// payment IS verification here, no document or admin review step. Flips the
// linked VerificationRequest straight to APPROVED and sets `verified` on
// whichever salon/shop it was for in the same transaction, so the badge and
// the request's own status change atomically together.
export async function markVerificationPaymentPaid(payment: Payment) {
  if (payment.purpose !== "VERIFICATION") return;

  const request = await prisma.verificationRequest.findUnique({ where: { paymentId: payment.id } });
  if (!request || request.status !== "AWAITING_PAYMENT") return;

  const verifiedAt = new Date();
  await prisma.$transaction([
    prisma.verificationRequest.update({
      where: { id: request.id },
      data: { status: "APPROVED", reviewedAt: verifiedAt },
    }),
    request.salonId
      ? prisma.salon.update({ where: { id: request.salonId }, data: { verified: true, verifiedAt } })
      : prisma.shop.update({ where: { id: request.shopId! }, data: { verified: true, verifiedAt } }),
  ]);
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
