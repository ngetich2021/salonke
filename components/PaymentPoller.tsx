"use client";

import { useEffect, useState } from "react";
import { getPaymentStatusAction } from "@/lib/actions";

const POLL_INTERVAL_MS = 3000;
const TIMEOUT_MS = 90000;

export function PaymentPoller({
  paymentId,
  onSuccess,
  onSettle,
}: {
  paymentId: string;
  onSuccess?: () => void;
  // Fired for every terminal-ish state (failed/timeout too, not just
  // success) so callers can offer a retry once it's clear this attempt
  // isn't going to resolve on its own.
  onSettle?: (state: "success" | "failed" | "timeout") => void;
}) {
  const [state, setState] = useState<"pending" | "success" | "failed" | "timeout">("pending");

  useEffect(() => {
    let cancelled = false;
    const startedAt = Date.now();

    async function poll() {
      if (cancelled) return;
      try {
        const { status } = await getPaymentStatusAction(paymentId);
        if (cancelled) return;
        if (status === "SUCCESS") {
          setState("success");
          onSuccess?.();
          onSettle?.("success");
          return;
        }
        if (status === "FAILED") {
          setState("failed");
          onSettle?.("failed");
          return;
        }
      } catch {
        // transient — keep polling until the timeout below gives up
      }
      if (Date.now() - startedAt >= TIMEOUT_MS) {
        setState("timeout");
        onSettle?.("timeout");
        return;
      }
      setTimeout(poll, POLL_INTERVAL_MS);
    }

    poll();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentId]);

  if (state === "success") {
    return <p className="text-xs text-emerald-700 dark:text-emerald-400">✓ Payment confirmed.</p>;
  }
  if (state === "failed") {
    return (
      <p className="text-xs text-red-600 dark:text-red-400">
        Payment failed or was cancelled. You can try again.
      </p>
    );
  }
  if (state === "timeout") {
    return (
      <p className="text-xs text-amber-700 dark:text-amber-400">
        Still waiting for confirmation — check your phone. This will keep working in the
        background even if you close this.
      </p>
    );
  }
  return (
    <p className="text-xs text-zinc-500 dark:text-zinc-400">
      📲 Check your phone and enter your M-Pesa PIN to confirm — waiting for confirmation…
    </p>
  );
}
