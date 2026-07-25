"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { requestVerificationAction } from "@/lib/actions";
import { PaymentPoller } from "@/components/PaymentPoller";
import { VERIFICATION_FEE_KES } from "@/lib/pricing";

export type VerificationListing = {
  type: "salon" | "shop";
  id: string;
  name: string;
  verified: boolean;
  verifiedAt: Date | null;
  // Payment confirms verification directly (see markVerificationPaymentPaid)
  // — the only other state a listing can be in is "payment still in
  // flight," so this is really just an in-progress flag, not a full status.
  awaitingPayment: boolean;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="self-start rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Submitting…" : `Pay Kes ${VERIFICATION_FEE_KES} and submit`}
    </button>
  );
}

function ListingRequestForm({ listing, initialPhone }: { listing: VerificationListing; initialPhone: string | null }) {
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (paymentId) {
    return (
      <div className="flex flex-col gap-2 text-sm">
        <p>Requesting Kes {VERIFICATION_FEE_KES} via M-Pesa — check your phone.</p>
        <PaymentPoller paymentId={paymentId} />
      </div>
    );
  }

  return (
    <form
      action={async (formData: FormData) => {
        setError(null);
        try {
          const result = await requestVerificationAction(formData);
          setPaymentId(result.paymentId);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Something went wrong.");
        }
      }}
      className="flex flex-col gap-3 text-sm"
    >
      <input type="hidden" name="listingType" value={listing.type} />

      <label className="flex flex-col gap-1 text-foreground">
        Phone number for the M-Pesa prompt
        <input
          name="phone"
          type="tel"
          required
          defaultValue={initialPhone ?? ""}
          placeholder="e.g. 07XXXXXXXX"
          className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-transparent"
        />
      </label>

      {error && <p className="text-red-600 dark:text-red-400">{error}</p>}

      <SubmitButton />
    </form>
  );
}

function ListingStatus({ listing }: { listing: VerificationListing }) {
  if (listing.verified) {
    return (
      <p className="flex items-center gap-2 text-sm">
        <span className="rounded-full bg-purple-600 px-2 py-0.5 text-xs font-semibold text-white">
          ✓ Verified
        </span>
        {listing.verifiedAt && (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            since {listing.verifiedAt.toLocaleDateString()}
          </span>
        )}
      </p>
    );
  }

  if (listing.awaitingPayment) {
    return (
      <p className="text-xs text-amber-700 dark:text-amber-400">
        Awaiting your M-Pesa payment to confirm — check your phone, or try again below.
      </p>
    );
  }

  return null;
}

export function VerificationSettings({
  listings,
  initialPhone,
}: {
  listings: VerificationListing[];
  initialPhone: string | null;
}) {
  if (listings.length === 0) return null;

  return (
    <div className="flex flex-col gap-4 border-t border-black/[.08] pt-6 dark:border-white/[.145]">
      <div>
        <h3 className="text-sm font-semibold">Verification</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Pay a one-time Kes {VERIFICATION_FEE_KES} fee to get a verified badge on your listing —
          just your phone number, no documents needed.
        </p>
      </div>

      {listings.map((listing) => {
        // A form only makes sense while there's nothing already in flight.
        const canSubmit = !listing.verified && !listing.awaitingPayment;

        return (
          <div
            key={listing.id}
            className="flex flex-col gap-2 rounded-lg border border-black/[.08] p-4 dark:border-white/[.145]"
          >
            <p className="text-sm font-medium">
              {listing.name}{" "}
              <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
                ({listing.type})
              </span>
            </p>
            <ListingStatus listing={listing} />
            {canSubmit && <ListingRequestForm listing={listing} initialPhone={initialPhone} />}
          </div>
        );
      })}
    </div>
  );
}
