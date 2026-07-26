import type { Metadata } from "next";
import Link from "next/link";
import { Panel } from "@/components/Panel";
import { AD_BASE_RATE_KES, AD_REPEAT_RATE_KES, VERIFICATION_FEE_KES } from "@/lib/pricing";
import { SUSPENSION_DELETE_ELIGIBLE_DAYS } from "@/lib/suspension";
import { VERIFICATION_PERIOD_DAYS } from "@/lib/verification";

export const metadata: Metadata = {
  title: "Terms and Conditions — SalonKE",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="flex flex-col gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        {children}
      </div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-xl font-semibold">Terms and Conditions</h1>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          These terms cover how SalonKE actually works. If anything here conflicts with local law,
          local law wins.
        </p>
      </div>

      <Panel className="flex flex-col gap-6">
        <Section title="What SalonKE is">
          <p>
            SalonKE is a directory and marketplace that connects customers with nearby salons
            (services) and shops (products), and lets brand owners run paid video ad campaigns to
            reach them. We host the listings, ordering, and advertising tools — we are not a party
            to any sale between a customer and a salon or shop.
          </p>
        </Section>

        <Section title="Accounts and listings">
          <p>
            You&apos;re responsible for the accuracy of anything you submit under your account —
            listing details, service/product info, and any video or image you upload. Salons and
            shops are reviewed and may be suspended by an admin at any time (for policy violations,
            complaints, or fraud). A suspended listing that stays suspended for{" "}
            {SUSPENSION_DELETE_ELIGIBLE_DAYS} days becomes eligible for permanent deletion.
          </p>
        </Section>

        <Section title="Orders and payment">
          <p>
            When you place an order for a service or product, payment for that order happens
            directly between you and the salon or shop — SalonKE does not process or hold that
            payment. Order status (accepted, completed, cancelled) is set by the salon/shop or
            customer involved; we only record it for both sides to track.
          </p>
        </Section>

        <Section title="Advertising">
          <p>
            Ad campaigns are paid via M-Pesa at submission (currently Kes {AD_BASE_RATE_KES}/day,
            plus Kes {AD_REPEAT_RATE_KES}/day for each extra repeat per loop you choose), and go
            live only once payment is confirmed and an admin approves the ad. A campaign runs for
            the number of days you paid for, starting from approval — not from payment — so a
            slower review never eats into your paid days. Campaign fees are for the review and
            rotation slot itself and are not refundable once the ad has been approved and started
            running.
          </p>
        </Section>

        <Section title="Verification">
          <p>
            Salon and shop owners can pay for a verified badge on their listing (currently Kes{" "}
            {VERIFICATION_FEE_KES} per {VERIFICATION_PERIOD_DAYS}-day period) from account
            settings — payment itself confirms it, no document or review required. It only stays
            active while paid up; it isn&apos;t charged automatically, so it lapses if not renewed
            before the period ends. We can revoke a verified badge at any time regardless of a
            paid period remaining, if the listing is found to be misrepresented or in violation of
            these terms.
          </p>
        </Section>

        <Section title="Location and contact info">
          <p>
            We use the location you share (or your device&apos;s location, with your permission)
            to show you nearby salons, shops, and local ads, and to sort search results by
            distance. Phone numbers shown on listings and ads are masked by default — tapping the
            number dials it directly on a phone, or reveals it on a device that can&apos;t place a
            call.
          </p>
        </Section>

        <Section title="Content and third parties">
          <p>
            Video ads are either a YouTube link (played through YouTube&apos;s own embedded
            player, subject to YouTube&apos;s terms) or a file you upload directly. You&apos;re
            responsible for having the rights to any video you submit. Payments are processed via
            Safaricom&apos;s M-Pesa; we don&apos;t store your M-Pesa PIN or full payment
            credentials.
          </p>
        </Section>

        <Section title="Reporting a problem">
          <p>
            If something&apos;s wrong — a broken ad, a listing that shouldn&apos;t be up, a bug, or
            anything else — use the{" "}
            <Link href="/report" className="underline">
              report an issue
            </Link>{" "}
            form. Anyone can submit a report, no account required.
          </p>
        </Section>

        <Section title="Changes to these terms">
          <p>
            We may update these terms as the product changes. Continuing to use SalonKE after an
            update means you accept the current version.
          </p>
        </Section>
      </Panel>
    </div>
  );
}
