// Split out from lib/verification.ts so client components (VerificationSettings,
// SalonCard) can import the pure constant/helper without pulling in that file's
// server-only imports (next/cache's revalidateTag, prisma, mpesa) into the
// client bundle.
export const VERIFICATION_PERIOD_DAYS = 30;

// See lib/verification.ts for the full rationale behind computing this on
// read instead of trusting a stored flag.
export function isVerificationActive(listing: {
  verified: boolean;
  verificationExpiresAt: Date | null;
}): boolean {
  if (!listing.verified) return false;
  if (!listing.verificationExpiresAt) return false;
  return new Date(listing.verificationExpiresAt) > new Date();
}
