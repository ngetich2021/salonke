"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useFormStatus } from "react-dom";
import { submitIssueReportAction } from "@/lib/actions";

function SubmitReportButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="self-start rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Sending…" : "Send report"}
    </button>
  );
}

export function ReportIssueForm({
  defaultName,
  defaultEmail,
}: {
  defaultName?: string | null;
  defaultEmail?: string | null;
}) {
  const pathname = usePathname();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (submitted) {
    return (
      <p className="text-sm text-emerald-700 dark:text-emerald-400">
        ✓ Thanks — your report was sent. We&apos;ll look into it.
      </p>
    );
  }

  return (
    <form
      action={async (formData: FormData) => {
        setError(null);
        try {
          await submitIssueReportAction(formData);
          setSubmitted(true);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Something went wrong.");
        }
      }}
      className="flex flex-col gap-3 text-sm"
    >
      <input type="hidden" name="pageUrl" value={pathname} />

      <label className="flex flex-col gap-1 text-foreground">
        Your name (optional)
        <input
          name="name"
          defaultValue={defaultName ?? ""}
          className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-transparent"
        />
      </label>

      <label className="flex flex-col gap-1 text-foreground">
        Your email (optional — only if you want a reply)
        <input
          name="email"
          type="email"
          defaultValue={defaultEmail ?? ""}
          className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-transparent"
        />
      </label>

      <label className="flex flex-col gap-1 text-foreground">
        What&apos;s the issue?
        <textarea
          name="message"
          required
          rows={5}
          placeholder="Describe what happened — a broken ad, a listing that shouldn't be up, a bug, anything."
          className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-transparent"
        />
      </label>

      {error && <p className="text-red-600 dark:text-red-400">{error}</p>}

      <SubmitReportButton />
    </form>
  );
}
