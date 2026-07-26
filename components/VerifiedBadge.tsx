// Small inline "verified" checkmark badge, appended directly against a
// salon/shop name (X/Facebook style) rather than shown as a separate pill —
// same underlying signal as the purple VerificationSettings status pill (an
// active, paid VerificationRequest; see lib/verification.ts
// isVerificationActive), just rendered pink and touching the name instead.
export function VerifiedBadge({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-label="Verified"
      role="img"
      className={`ml-0.5 inline-block h-[1em] w-[1em] shrink-0 align-middle text-pink-500 ${className}`}
      fill="currentColor"
    >
      <circle cx="12" cy="12" r="10" />
      <path
        d="M8.5 12.5l2.5 2.5 4.5-5"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
