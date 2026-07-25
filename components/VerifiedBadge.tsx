// Purple badge shown next to a salon/shop name once an admin has approved a
// paid VerificationRequest for it (see lib/verification.ts / requestVerificationAction).
export function VerifiedBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-purple-600 px-2 py-0.5 text-[10px] font-semibold text-white ${className}`}
    >
      ✓ Verified
    </span>
  );
}
