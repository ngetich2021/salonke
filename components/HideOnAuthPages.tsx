"use client";

import { usePathname } from "next/navigation";

const HIDDEN_PATHS = new Set(["/login", "/signup"]);

// Login/signup are meant to be a single focused form — the global ad reel
// (video + share box + "Interested" button) sitting above it just pushes the
// actual form down the page, especially on mobile where it eats the whole
// first screen. Hidden here rather than skipped inside GlobalAdReel itself
// so every other route keeps it unconditionally.
export function HideOnAuthPages({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (HIDDEN_PATHS.has(pathname)) return null;
  return <>{children}</>;
}
