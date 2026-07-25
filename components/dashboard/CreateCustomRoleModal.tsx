"use client";

import { useRef, useState } from "react";
import { Modal, type ModalHandle } from "@/components/Modal";
import { SubmitButton } from "@/components/SubmitButton";

export function CreateCustomRoleModal({
  action,
}: {
  action: (formData: FormData) => Promise<void>;
}) {
  const modalRef = useRef<ModalHandle>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  return (
    <Modal ref={modalRef} triggerLabel="Create role" title="Create staff role">
      <form
        action={async (formData: FormData) => {
          setSubmitError(null);
          try {
            await action(formData);
            modalRef.current?.close();
          } catch (err) {
            setSubmitError(err instanceof Error ? err.message : "Something went wrong.");
          }
        }}
        className="flex flex-col gap-3 text-sm"
      >
        <label className="flex flex-col gap-1">
          Role name
          <input
            name="name"
            required
            placeholder="e.g. Customer care, Accountant"
            className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-transparent"
          />
        </label>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-semibold">Can view</legend>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="canViewUsers" />
            Users
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="canViewSalons" />
            Salons
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="canViewShops" />
            Shops
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="canViewOrders" />
            Orders
          </label>
        </fieldset>
        {submitError && (
          <p className="text-red-600 dark:text-red-400">{submitError}</p>
        )}
        <SubmitButton
          pendingText="Creating…"
          className="self-start rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background"
        >
          Create role
        </SubmitButton>
      </form>
    </Modal>
  );
}
