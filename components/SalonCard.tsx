import type { Salon } from "@/lib/generated/prisma/client";
import { ContactIcons } from "@/components/ContactIcons";
import { Photo } from "@/components/Photo";
import { PhoneButton } from "@/components/PhoneButton";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { isVerificationActive } from "@/lib/verification";

export function SalonCard({
  salon,
  distanceKm,
  isDrivingDistance = false,
}: {
  salon: Salon;
  distanceKm: number;
  isDrivingDistance?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-black/[.08] bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-white/[.145] dark:bg-zinc-900">
      <div className="flex flex-1 items-center gap-4">
        <Photo
          src={salon.imageUrl}
          alt={salon.contactName}
          className="h-20 w-20 shrink-0 rounded-lg"
        />
        <div className="space-y-1 text-sm">
          <p>
            <span className="font-semibold">Name:</span> {salon.contactName}
          </p>
          <p>
            <span className="font-semibold">Tel :</span>{" "}
            <PhoneButton phone={salon.phone} className="underline underline-offset-2" />
          </p>
          {salon.phone2 && (
            <p>
              <span className="font-semibold">Tel 1:</span>{" "}
              <PhoneButton phone={salon.phone2} className="underline underline-offset-2" />
            </p>
          )}
          <p className="flex items-center gap-2">
            <span className="font-semibold">salon:</span>
            <span>
              {salon.name}
              {isVerificationActive(salon) && <VerifiedBadge />}
            </span>
          </p>
          <p>
            <span className="font-semibold">centre:</span> {salon.centreName}
          </p>
          <p>
            <span className="font-semibold">
              {isDrivingDistance ? "driving distance:" : "distance:"}
            </span>{" "}
            {distanceKm.toFixed(1)} km
          </p>
        </div>
      </div>
      <ContactIcons tiktokUrl={salon.tiktokUrl} />
    </div>
  );
}
