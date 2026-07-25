"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { recordSiteVisitAction } from "@/lib/actions";

// Fires once per page view (initial load and every client-side route change)
// to power the admin-only "site visitors by day" panel. Best-effort and
// invisible — never blocks or errors the page it's mounted on.
export function VisitTracker() {
  const pathname = usePathname();

  useEffect(() => {
    recordSiteVisitAction().catch(() => {});
  }, [pathname]);

  return null;
}
