"use client";

import { useEffect } from "react";
import { Panel } from "@/components/Panel";

// Catches anything thrown by a server action that isn't already caught and
// shown inline by the calling client component (most forms wrap their
// action call in try/catch and show the message next to the form itself —
// see CreateAdvertModal for that pattern — but several simpler forms across
// the app call their server action directly as `action={fn}`, with no
// client-side catch of their own). Without this boundary, a thrown
// validation error from any of those had nowhere to land and fell through
// to Next's default, unstyled crash screen instead of a readable message.
export default function ErrorBoundary({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <Panel className="flex w-full flex-col gap-3">
        <h1 className="text-sm font-semibold">Something went wrong</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{error.message}</p>
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="self-center rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background"
        >
          Try again
        </button>
      </Panel>
    </div>
  );
}
