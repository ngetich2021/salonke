"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { requestVerificationAction } from "@/lib/actions";
import { PaymentPoller } from "@/components/PaymentPoller";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { VERIFICATION_FEE_KES } from "@/lib/pricing";
import { VERIFICATION_PERIOD_DAYS } from "@/lib/verification-shared";

export type VerificationListing = {
  type: "salon" | "shop";
  id: string;
  name: string;
  // Whether the badge is eligible to show right now (isVerificationActive)
  // — not the raw `verified` column, which stays true forever once set and
  // says nothing about whether the current paid period has actually lapsed.
  active: boolean;
  verificationExpiresAt: Date | null;
  // True only while the latest request's Payment is still PENDING (STK push
  // sent, no result yet) — this is the only thing that should block a new
  // attempt. A FAILED payment leaves the request row stuck at
  // AWAITING_PAYMENT forever (see requestVerificationAction), so that alone
  // can't be treated as "in progress" or a retry would never be possible.
  awaitingPayment: boolean;
  paymentFailed: boolean;
};

function SubmitButton({ renewing }: { renewing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="self-start rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending
        ? "Submitting…"
        : renewing
          ? `Pay Kes ${VERIFICATION_FEE_KES} to extend ${VERIFICATION_PERIOD_DAYS} more days`
          : `Pay Kes ${VERIFICATION_FEE_KES} for ${VERIFICATION_PERIOD_DAYS} days`}
    </button>
  );
}

function ListingRequestForm({
  listing,
  initialPhone,
}: {
  listing: VerificationListing;
  initialPhone: string | null;
}) {
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [settled, setSettled] = useState<"failed" | "timeout" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (paymentId) {
    return (
      <div className="flex flex-col gap-2 text-sm">
        <p>Requesting Kes {VERIFICATION_FEE_KES} via M-Pesa — check your phone.</p>
        <PaymentPoller
          paymentId={paymentId}
          onSettle={(state) => setSettled(state === "success" ? null : state)}
        />
        {settled && (
          <button
            type="button"
            onClick={() => {
              setPaymentId(null);
              setSettled(null);
            }}
            className="self-start text-xs font-medium underline"
          >
            Try again
          </button>
        )}
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

      <SubmitButton renewing={listing.active} />
    </form>
  );
}

function ListingStatus({ listing }: { listing: VerificationListing }) {
  if (listing.active) {
    return (
      <p className="flex items-center gap-2 text-sm">
        <span className="rounded-full bg-purple-600 px-2 py-0.5 text-xs font-semibold text-white">
          ✓ Verified
        </span>
        {listing.verificationExpiresAt && (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            until {listing.verificationExpiresAt.toLocaleDateString()}
          </span>
        )}
      </p>
    );
  }

  if (listing.awaitingPayment) {
    return (
      <p className="text-xs text-amber-700 dark:text-amber-400">
        Awaiting your M-Pesa payment to confirm — check your phone.
      </p>
    );
  }

  if (listing.paymentFailed) {
    return (
      <p className="text-xs text-red-600 dark:text-red-400">
        Your last verification payment didn&apos;t go through — try again below.
      </p>
    );
  }

  if (listing.verificationExpiresAt) {
    return (
      <p className="text-xs text-amber-700 dark:text-amber-400">
        Your verification lapsed on {listing.verificationExpiresAt.toLocaleDateString()} — renew
        below to bring the badge back.
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
          Kes {VERIFICATION_FEE_KES} gets your listing a verified badge for{" "}
          {VERIFICATION_PERIOD_DAYS} days — just your phone number, no documents needed. It renews
          only when you pay again; nothing is charged automatically.
        </p>
      </div>

      {listings.map((listing) => {
        // A renewal form makes sense any time — even while already active,
        // to extend before it lapses — the only thing that blocks it is a
        // payment already in flight.
        const canSubmit = !listing.awaitingPayment;

        return (
          <div
            key={listing.id}
            className="flex flex-col gap-2 rounded-lg border border-black/[.08] p-4 dark:border-white/[.145]"
          >
            <p className="text-sm font-medium">
              {listing.name}
              {listing.active && <VerifiedBadge />}{" "}
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
