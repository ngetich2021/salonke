"use client";

import { useActionState, useEffect, useState } from "react";
import { MapPicker } from "@/components/MapPicker";

export type CreateListingState = { error?: string; success?: boolean } | undefined;

export function CreateListingForm({
  action,
  initialType = "salon",
  onSuccess,
}: {
  action: (
    prevState: CreateListingState,
    formData: FormData
  ) => Promise<CreateListingState>;
  initialType?: "salon" | "shop" | "both";
  onSuccess?: () => void;
}) {
  const [state, formAction, isPending] = useActionState(action, undefined);

  useEffect(() => {
    if (state?.success) onSuccess?.();
  }, [state, onSuccess]);
  const [type, setType] = useState<"salon" | "shop" | "both">(initialType);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const needsSalonFields = type === "salon" || type === "both";

  function useMyLocation() {
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError("Geolocation isn't supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
      },
      () => setLocationError("Couldn't get your location. Pick it on the map instead.")
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 text-sm">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-semibold">What are you listing?</legend>
        {(["salon", "shop", "both"] as const).map((option) => (
          <label key={option} className="flex items-center gap-2">
            <input
              type="radio"
              name="type"
              value={option}
              defaultChecked={option === initialType}
              onChange={() => setType(option)}
            />
            {option === "salon" && "Salon"}
            {option === "shop" && "Beauty shop"}
            {option === "both" && "Both"}
          </label>
        ))}
      </fieldset>

      <label className="flex flex-col gap-1">
        Business name
        <input
          name="name"
          required
          className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-transparent"
        />
      </label>

      <label className="flex flex-col gap-1">
        Phone
        <input
          name="phone"
          required
          className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-transparent"
        />
      </label>

      <label className="flex flex-col gap-1">
        WhatsApp number (optional)
        <input
          name="whatsappNumber"
          className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-transparent"
        />
      </label>

      <label className="flex flex-col gap-1">
        TikTok URL (optional)
        <input
          name="tiktokUrl"
          type="url"
          placeholder="https://www.tiktok.com/@yourbusiness"
          className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-transparent"
        />
      </label>

      {needsSalonFields && (
        <>
          <label className="flex flex-col gap-1">
            Contact name
            <input
              name="contactName"
              required={needsSalonFields}
              className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-transparent"
            />
          </label>
          <label className="flex flex-col gap-1">
            Centre name
            <input
              name="centreName"
              required={needsSalonFields}
              className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-transparent"
            />
          </label>
        </>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <span className="font-semibold">Location</span>
          <button
            type="button"
            onClick={useMyLocation}
            className="rounded-full border border-black/[.08] px-3 py-1 text-xs font-medium dark:border-white/[.145]"
          >
            📍 Use my location
          </button>
        </div>
        <MapPicker
          lat={lat}
          lng={lng}
          onChange={(newLat, newLng) => {
            setLat(newLat);
            setLng(newLng);
          }}
        />
        <input type="hidden" name="latitude" value={lat ?? ""} />
        <input type="hidden" name="longitude" value={lng ?? ""} />
        {lat != null && lng != null ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {lat.toFixed(4)}, {lng.toFixed(4)}
          </p>
        ) : (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Tap the map to set your business location.
          </p>
        )}
        {locationError && (
          <p className="text-red-600 dark:text-red-400">{locationError}</p>
        )}
      </div>

      {state?.error && (
        <p className="text-red-600 dark:text-red-400">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        aria-disabled={isPending}
        className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Creating…" : "Create listing"}
      </button>
    </form>
  );
}
