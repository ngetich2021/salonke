"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { MapPicker } from "@/components/MapPicker";
import { SubmitButton } from "@/components/SubmitButton";
import { Modal } from "@/components/Modal";

function DeleteAccountButton({ confirmed }: { confirmed: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={!confirmed || pending}
      aria-disabled={!confirmed || pending}
      className="self-start rounded-full bg-red-600 px-4 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Deleting…" : "Delete account"}
    </button>
  );
}

function DeleteAccountSection({
  deleteAccountAction,
}: {
  deleteAccountAction: () => Promise<void>;
}) {
  const [confirmText, setConfirmText] = useState("");

  return (
    <Modal
      triggerLabel="Delete account"
      triggerClassName="self-start rounded-full border border-red-600 px-4 py-2 text-xs font-medium text-red-600 hover:bg-red-600/10"
      title="Delete account"
    >
      <form action={deleteAccountAction} className="flex flex-col gap-3 text-sm">
        <p className="text-zinc-600 dark:text-zinc-400">
          This permanently deletes your account, your orders, and any salon or
          shop listing you own. This can&apos;t be undone.
        </p>
        <label className="flex flex-col gap-1">
          Type <span className="font-semibold">DELETE</span> to confirm
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-transparent"
          />
        </label>
        <DeleteAccountButton confirmed={confirmText === "DELETE"} />
      </form>
    </Modal>
  );
}

export function AccountSettings({
  phone,
  latitude,
  longitude,
  ownsListing,
  updateProfileAction,
  deleteAccountAction,
}: {
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  ownsListing: boolean;
  updateProfileAction: (formData: FormData) => Promise<void>;
  deleteAccountAction: () => Promise<void>;
}) {
  const [lat, setLat] = useState<number | null>(latitude);
  const [lng, setLng] = useState<number | null>(longitude);
  const [locationError, setLocationError] = useState<string | null>(null);

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
      () => setLocationError("Couldn't get your location. Pick it on the map instead."),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <form action={updateProfileAction} className="flex flex-col gap-4 text-sm">
        {ownsListing && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Saving here also updates your salon or shop&apos;s phone and
            location.
          </p>
        )}
        <label className="flex flex-col gap-1">
          Phone number
          <input
            name="phone"
            type="tel"
            defaultValue={phone ?? ""}
            placeholder="07xx xxx xxx"
            className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-transparent"
          />
        </label>

        {ownsListing && (
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
                Tap the map to set your location.
              </p>
            )}
            {locationError && (
              <p className="text-red-600 dark:text-red-400">{locationError}</p>
            )}
          </div>
        )}

        <SubmitButton
          pendingText="Saving…"
          className="self-start rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background"
        >
          Save changes
        </SubmitButton>
      </form>

      <div className="flex flex-col gap-2 border-t border-black/[.08] pt-6 dark:border-white/[.145]">
        <h3 className="text-sm font-semibold text-red-600 dark:text-red-400">
          Danger zone
        </h3>
        <DeleteAccountSection deleteAccountAction={deleteAccountAction} />
      </div>
    </div>
  );
}
