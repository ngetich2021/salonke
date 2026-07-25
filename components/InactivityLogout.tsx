"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";

const IDLE_MS = 3 * 60 * 1000;
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"] as const;

export function InactivityLogout() {
  const [hasSession, setHasSession] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setHasSession(!!data?.user);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasSession) return;

    function reset() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        signOut({ redirectTo: "/login" });
      }, IDLE_MS);
    }

    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, reset));
    reset();

    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, reset));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [hasSession]);

  return null;
}
