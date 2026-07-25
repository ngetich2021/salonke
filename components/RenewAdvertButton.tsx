"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Modal, type ModalHandle } from "@/components/Modal";
import { PaymentPoller } from "@/components/PaymentPoller";
import { renewAdCampaignAction } from "@/lib/actions";
import { AD_BASE_RATE_KES, AD_REPEAT_RATE_KES, adCampaignTotalKes } from "@/lib/pricing";

function RenewButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="self-start rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Requesting payment…" : "Pay & renew"}
    </button>
  );
}

export function RenewAdvertButton({
  advertId,
  productName,
  initialPhone,
  initialPackageDays,
  initialRepeatCount,
}: {
  advertId: string;
  productName: string;
  initialPhone: string | null;
  initialPackageDays: number;
  initialRepeatCount: number;
}) {
  const modalRef = useRef<ModalHandle>(null);
  const [packageDays, setPackageDays] = useState(initialPackageDays);
  const [repeatCount, setRepeatCount] = useState(initialRepeatCount);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const totalKes = adCampaignTotalKes(packageDays, repeatCount);

  return (
    <Modal
      ref={modalRef}
      triggerLabel="Renew"
      triggerClassName="rounded-full border border-black/[.08] px-3 py-1 text-xs font-medium dark:border-white/[.145]"
      title={`Renew — ${productName}`}
    >
      {paymentId ? (
        <div className="flex flex-col gap-3 text-sm">
          <p>Requesting Kes {totalKes} via M-Pesa — check your phone.</p>
          <PaymentPoller paymentId={paymentId} />
          <button
            type="button"
            onClick={() => modalRef.current?.close()}
            className="self-start rounded-full border border-black/[.08] px-4 py-2 text-xs font-medium dark:border-white/[.145]"
          >
            Close
          </button>
        </div>
      ) : (
        <form
          action={async (formData: FormData) => {
            setError(null);
            try {
              const result = await renewAdCampaignAction(formData);
              setPaymentId(result.paymentId);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Something went wrong.");
            }
          }}
          className="flex flex-col gap-3 text-sm"
        >
          <input type="hidden" name="advertId" value={advertId} />
          <label className="flex flex-col gap-1 text-foreground">
            Phone number
            <input
              name="phone"
              type="tel"
              required
              defaultValue={initialPhone ?? ""}
              className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-transparent"
            />
          </label>
          <label className="flex flex-col gap-1 text-foreground">
            Days to run (Kes {AD_BASE_RATE_KES}/day)
            <input
              name="packageDays"
              type="number"
              min="1"
              step="1"
              required
              value={packageDays}
              onChange={(e) => setPackageDays(Math.max(1, Number(e.target.value) || 1))}
              className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-transparent"
            />
          </label>
          <label className="flex flex-col gap-1 text-foreground">
            Extra repeats per loop (Kes {AD_REPEAT_RATE_KES}/day each)
            <input
              name="repeatCount"
              type="number"
              min="0"
              step="1"
              value={repeatCount}
              onChange={(e) => setRepeatCount(Math.max(0, Number(e.target.value) || 0))}
              className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-transparent"
            />
          </label>
          <p className="font-semibold">Total: Kes {totalKes}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Continues instantly once payment confirms — no admin re-review needed.
          </p>
          {error && <p className="text-red-600 dark:text-red-400">{error}</p>}
          <RenewButton />
        </form>
      )}
    </Modal>
  );
}
