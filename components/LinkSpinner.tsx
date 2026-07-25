"use client";

import { useLinkStatus } from "next/link";

// Renders inside a <Link> (as a descendant, not the Link itself) to show a
// spinner while that specific navigation is pending — e.g. clicking into a
// shop/salon from the results list, where the destination re-runs a DB
// query and isn't instant.
export function LinkSpinner({ className = "" }: { className?: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;

  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-black/[.08] border-t-foreground dark:border-white/[.145] ${className}`}
    />
  );
}
