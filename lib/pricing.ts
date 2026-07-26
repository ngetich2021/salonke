// TEST PRICING — intentionally reduced from the real rates below while the
// M-Pesa flow is being shaken out against the live production account (test
// charges get manually reversed). Switch to the commented real values once
// testing is done — every fee in the app reads from here, nowhere else.
export const AD_BASE_RATE_KES = 25; // real: 250
export const AD_REPEAT_RATE_KES = 20; // real: 200
// Recurring monthly charge (see VERIFICATION_PERIOD_DAYS in lib/verification.ts)
// — the badge lapses if it isn't paid again before the current period ends.
export const VERIFICATION_FEE_KES = 20; // real: 200/month

export function adCampaignTotalKes(packageDays: number, repeatCount: number) {
  return (AD_BASE_RATE_KES + AD_REPEAT_RATE_KES * repeatCount) * packageDays;
}
