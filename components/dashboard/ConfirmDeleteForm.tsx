"use client";

import { useFormStatus } from "react-dom";

function DeleteButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className="rounded-full border border-red-600 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-600/10 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}

export function ConfirmDeleteForm({
  action,
  hiddenName,
  hiddenValue,
  confirmMessage,
}: {
  action: (formData: FormData) => Promise<void>;
  hiddenName: string;
  hiddenValue: string;
  confirmMessage: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(confirmMessage)) e.preventDefault();
      }}
    >
      <input type="hidden" name={hiddenName} value={hiddenValue} />
      <DeleteButton />
    </form>
  );
}
