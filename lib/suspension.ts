// Shared between the admin actions (enforcement) and the admin UI (gating
// which buttons are shown) — a suspended salon/shop only becomes eligible
// for actual deletion once it's been suspended this long.
export const SUSPENSION_DELETE_ELIGIBLE_DAYS = 90;

export function isEligibleForDeletion(suspended: boolean, suspendedAt: Date | null) {
  if (!suspended || !suspendedAt) return false;
  const elapsedMs = Date.now() - suspendedAt.getTime();
  return elapsedMs >= SUSPENSION_DELETE_ELIGIBLE_DAYS * 24 * 60 * 60 * 1000;
}
