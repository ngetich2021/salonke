import { prisma } from "@/lib/prisma";
import type { StkCallbackResult } from "@/lib/mpesa";
import { markVerificationPaymentPaid } from "@/lib/verification";
import { activateOrExtendCampaign } from "@/lib/campaign";
import type { Payment } from "@/lib/generated/prisma/client";

// Shared by app/api/mpesa/callback/route.ts (Safaricom telling us) and
// getPaymentStatusAction's query fallback (us asking Safaricom, when the
// callback never arrives — see lib/mpesa.ts queryStkStatus) — both learn a
// result the same way, so both resolve it the same way. No-ops if the
// Payment isn't PENDING anymore (already resolved by whichever path got
// there first).
export async function applyStkResult(result: StkCallbackResult): Promise<Payment | null> {
  const payment = await prisma.payment.findUnique({
    where: { checkoutRequestId: result.checkoutRequestId },
  });
  if (!payment || payment.status !== "PENDING") {
    return payment;
  }

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: result.success ? "SUCCESS" : "FAILED",
      resultCode: result.resultCode,
      resultDesc: result.resultDesc,
      mpesaReceiptNumber: result.mpesaReceiptNumber,
      confirmedAt: new Date(),
    },
  });

  if (result.success) {
    if (updated.purpose === "VERIFICATION") {
      await markVerificationPaymentPaid(updated);
    } else if (updated.purpose === "AD_CAMPAIGN" && updated.advertId) {
      const advert = await prisma.advert.findUnique({ where: { id: updated.advertId } });
      if (advert) await activateOrExtendCampaign(advert, updated);
    }
  }

  return updated;
}
