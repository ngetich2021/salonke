"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MapPicker } from "@/components/MapPicker";

export function LocationPicker() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialLat = searchParams.get("lat");
  const initialLng = searchParams.get("lng");
  const [lat, setLat] = useState<number | null>(
    initialLat ? Number(initialLat) : null
  );
  const [lng, setLng] = useState<number | null>(
    initialLng ? Number(initialLng) : null
  );
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [isPending, startTransition] = useTransition();

  function navigateTo(latitude: number, longitude: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("lat", String(latitude));
    params.set("lng", String(longitude));
    // A new location invalidates whatever result list/selection/page was
    // showing for the old one.
    params.delete("shopId");
    params.delete("salonId");
    params.delete("page");
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function handleAutoPick() {
    setError(null);
    if (!navigator.geolocation) {
      setError("Geolocation isn't supported by your browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        navigateTo(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        setLocating(false);
        setError("Couldn't get your location. Pick it on the map instead.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  function handleConfirm() {
    if (lat == null || lng == null) {
      setError("Tap the map to pick a location first.");
      return;
    }
    setError(null);
    navigateTo(lat, lng);
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-black/[.08] p-4 dark:border-white/[.145]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium">Tap the map to set your location</p>
        <button
          type="button"
          onClick={handleAutoPick}
          disabled={locating || isPending}
          aria-disabled={locating || isPending}
          className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-[#383838] disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-[#ccc]"
        >
          {locating ? "Locating…" : "📍 Use my location"}
        </button>
      </div>

      <MapPicker
        lat={lat}
        lng={lng}
        onChange={(newLat, newLng) => {
          setError(null);
          setLat(newLat);
          setLng(newLng);
          navigateTo(newLat, newLng);
        }}
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isPending || lat == null || lng == null}
          aria-disabled={isPending || lat == null || lng == null}
          className="rounded-full border border-black/[.08] px-4 py-2 text-sm font-medium hover:bg-black/[.04] disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
        >
          Use this location
        </button>
        {lat != null && lng != null && (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {lat.toFixed(4)}, {lng.toFixed(4)}
          </span>
        )}
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
