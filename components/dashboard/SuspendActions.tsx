"use client";

import { ConfirmDeleteForm } from "@/components/dashboard/ConfirmDeleteForm";
import { SubmitButton } from "@/components/SubmitButton";

// Admins can only suspend/unsuspend a salon or shop — outright deletion is
// only offered once it's been suspended long enough (see lib/suspension.ts).
export function SuspendActions({
  hiddenName,
  id,
  label,
  suspended,
  eligibleForDeletion,
  suspendAction,
  unsuspendAction,
  deleteAction,
}: {
  hiddenName: string;
  id: string;
  label: string;
  suspended: boolean;
  eligibleForDeletion: boolean;
  suspendAction: (formData: FormData) => Promise<void>;
  unsuspendAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {suspended ? (
        <form action={unsuspendAction}>
          <input type="hidden" name={hiddenName} value={id} />
          <SubmitButton
            pendingText="Unsuspending…"
            className="rounded-full border border-black/[.08] px-3 py-1 text-xs font-medium dark:border-white/[.145]"
          >
            Unsuspend
          </SubmitButton>
        </form>
      ) : (
        <form
          action={suspendAction}
          onSubmit={(e) => {
            if (
              !confirm(`Suspend ${label}? It will be hidden from customer search until unsuspended.`)
            ) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name={hiddenName} value={id} />
          <SubmitButton
            pendingText="Suspending…"
            className="rounded-full border border-amber-600 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-400"
          >
            Suspend
          </SubmitButton>
        </form>
      )}
      {eligibleForDeletion && (
        <ConfirmDeleteForm
          action={deleteAction}
          hiddenName={hiddenName}
          hiddenValue={id}
          confirmMessage={`Delete ${label}? This can't be undone.`}
        />
      )}
    </div>
  );
}
