"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  findShopsForAdvertAction,
  recordAdvertInterestAction,
  recordAdvertShareClickAction,
  recordAdvertViewAction,
  createOrderAction,
} from "@/lib/actions";
import { extractYouTubeId } from "@/lib/youtube";
import { cloudinaryVideoThumbnail } from "@/lib/media";
import { MapPicker } from "@/components/MapPicker";
import { PhoneButton } from "@/components/PhoneButton";
import { YouTubePlayer } from "@/components/YouTubePlayer";
import { FallbackVideoPlayer } from "@/components/FallbackVideoPlayer";
import { SubmitButton } from "@/components/SubmitButton";
import { ShareButtons } from "@/components/ShareButtons";

export type AdvertPlayerItem = {
  id: string;
  videoUrl: string;
  productName: string;
  serial: number | null;
  phone: string | null;
};

type ShopMatch = {
  shopId: string;
  shopName: string;
  phone: string | null;
  whatsappNumber: string | null;
  tiktokUrl: string | null;
  productId: string;
  productName: string;
  priceKes: number;
  distanceKm: number | null;
};

type ShopSearch = { loading: boolean; matches: ShopMatch[] | null; error: string | null };

export function AdvertPlayer({
  adverts,
  isAuthenticated,
  sticky = false,
}: {
  adverts: AdvertPlayerItem[];
  isAuthenticated: boolean;
  // Site-wide reel (GlobalAdReel, rendered as a body-level sibling in
  // layout.tsx) pins the video+name/advertiser strip to the top of the
  // viewport, with the rest of the page scrolling underneath it. The
  // in-page "video ads near you" reel on the shops page keeps the original
  // single, non-sticky card instead — sticky positioning only makes sense
  // for the one instance that's meant to stay visible for the whole page.
  sticky?: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // A shared link points here with `?ad=<advertId>` so the recipient lands
  // directly on the advert that was shared, instead of always index 0.
  const [index, setIndex] = useState(() => {
    const adParam = searchParams.get("ad");
    const found = adverts.findIndex((a) => a.id === adParam);
    return found >= 0 ? found : 0;
  });
  const [searches, setSearches] = useState<Record<string, ShopSearch>>({});

  // `?ref=<shareId>` on that same link is the "shared fully" signal — proof
  // the share actually reached someone, not just that the sharer clicked a
  // button. Counted once per page load (the ref flag survives re-renders,
  // guarding against StrictMode's double-invoke or the effect re-firing).
  const shareClickRecordedRef = useRef(false);
  useEffect(() => {
    const ref = searchParams.get("ref");
    if (!ref || shareClickRecordedRef.current) return;
    shareClickRecordedRef.current = true;
    recordAdvertShareClickAction(ref).catch(() => {});
  }, [searchParams]);

  // Counts a "visitor" for whichever advert is currently showing in the
  // player — fires on mount and every time the displayed ad changes (prev,
  // next, auto-advance on video end), powering the per-advert "visitors by
  // day" panel each owner sees on their own account page.
  const viewRecordedForRef = useRef<string | null>(null);
  useEffect(() => {
    const advertId = adverts[index]?.id;
    if (!advertId || viewRecordedForRef.current === advertId) return;
    viewRecordedForRef.current = advertId;
    recordAdvertViewAction(advertId).catch(() => {});
  }, [adverts, index]);

  const [viewerLat, setViewerLat] = useState<number | null>(null);
  const [viewerLng, setViewerLng] = useState<number | null>(null);
  const [askingLocation, setAskingLocation] = useState(false);
  const [pickingOnMap, setPickingOnMap] = useState(false);
  const [pickedLat, setPickedLat] = useState<number | null>(null);
  const [pickedLng, setPickedLng] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);
  const [skippedLocation, setSkippedLocation] = useState(false);
  // Starts unmuted and stays that way until the viewer explicitly hits the
  // 🔊 button themselves — no automatic muting/unmuting logic of any kind.
  // Browsers only allow autoplay-WITH-sound as a direct result of a user
  // gesture, so an unmuted autoplay attempt with no prior interaction can
  // get silently blocked; YouTubePlayer/FallbackVideoPlayer each fall back
  // to a one-time muted retry ONLY as the technical means to get the video
  // actually playing when that happens — that fallback never touches this
  // state, so the 🔊 button still reads (and behaves) as unmuted, and the
  // moment the viewer interacts with the page at all, the *next* ad swap
  // plays with real sound since it's no longer prior-interaction-less.
  const [muted, setMuted] = useState(false);

  if (adverts.length === 0) return null;

  const current = adverts[index];
  const videoId = extractYouTubeId(current.videoUrl);
  const search = searches[current.id];
  const poster = videoId ? null : cloudinaryVideoThumbnail(current.videoUrl);

  // Spacing repeats of the same ad among the others is handled entirely by
  // how the rotation array itself is built (see weightedAdRotation /
  // buildSpacedCycle in lib/campaign.ts — repeats of the same ad are kept at
  // least MIN_OTHER_ADS_BETWEEN_REPEATS other ads apart, shrinking only as
  // far as "never back-to-back" when there aren't enough other distinct ads
  // to keep the full gap) — goTo() here just walks whatever flat array it's
  // given, circularly, with no timing logic of its own.
  function goTo(newIndex: number) {
    setIndex(((newIndex % adverts.length) + adverts.length) % adverts.length);
  }

  function runSearch(lat: number | null, lng: number | null) {
    const advertId = current.id;
    setSearches((s) => ({ ...s, [advertId]: { loading: true, matches: null, error: null } }));
    findShopsForAdvertAction(advertId, lat, lng)
      .then((result) =>
        setSearches((s) => ({
          ...s,
          [advertId]: { loading: false, matches: result.matches, error: null },
        }))
      )
      .catch(() =>
        setSearches((s) => ({
          ...s,
          [advertId]: { loading: false, matches: null, error: "Couldn't search shops right now." },
        }))
      );
    // Best-effort — never blocks or errors the visible search above.
    recordAdvertInterestAction(advertId, lat, lng).catch(() => {});
  }

  function handleFindShops() {
    if (viewerLat != null && viewerLng != null) {
      runSearch(viewerLat, viewerLng);
      return;
    }
    setLocationNotice(null);
    setAskingLocation(true);
  }

  function useCurrentLocation() {
    setLocationNotice(null);
    if (!navigator.geolocation) {
      setLocationNotice("Geolocation isn't supported by your browser — pick your location on the map instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setViewerLat(pos.coords.latitude);
        setViewerLng(pos.coords.longitude);
        setSkippedLocation(false);
        setAskingLocation(false);
        runSearch(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        setLocating(false);
        setLocationNotice("Couldn't get your location — pick it on the map, or continue without it.");
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  }

  function confirmMapLocation() {
    if (pickedLat == null || pickedLng == null) return;
    setViewerLat(pickedLat);
    setViewerLng(pickedLng);
    setSkippedLocation(false);
    setAskingLocation(false);
    setPickingOnMap(false);
    runSearch(pickedLat, pickedLng);
  }

  function skipLocation() {
    setSkippedLocation(true);
    setAskingLocation(false);
    setPickingOnMap(false);
    runSearch(null, null);
  }

  const videoAndLabel = (
    <>
      <div className="relative">
        {videoId ? (
          <YouTubePlayer
            videoId={videoId}
            playKey={index}
            muted={muted}
            onEnded={() => goTo(index + 1)}
            className="h-48 w-full rounded-lg bg-black sm:h-56"
          />
        ) : (
          <FallbackVideoPlayer
            src={current.videoUrl}
            playKey={index}
            poster={poster}
            muted={muted}
            onEnded={() => goTo(index + 1)}
            className="h-48 w-full rounded-lg bg-black object-cover sm:h-56"
          />
        )}

        <button
          type="button"
          data-mute-toggle
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? "Unmute" : "Mute"}
          className="absolute left-2 top-2 rounded-full bg-zinc-900/60 px-2 py-1 text-xs text-white backdrop-blur-sm"
        >
          {muted ? "🔇" : "🔊"}
        </button>

        {adverts.length > 1 && (
          <div className="absolute bottom-2 right-2 flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              aria-label="Previous"
              className="rounded-full bg-zinc-900/60 px-2 py-1 text-white backdrop-blur-sm"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              aria-label="Next"
              className="rounded-full bg-zinc-900/60 px-2 py-1 text-white backdrop-blur-sm"
            >
              →
            </button>
          </div>
        )}
      </div>

      <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
        {current.serial != null ? `#${current.serial} — ` : ""}
        <span className="font-medium text-foreground">{current.productName}</span>
      </p>
    </>
  );

  const engagement = (
    <>
      <ShareButtons key={current.id} advertId={current.id} productName={current.productName} />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleFindShops}
          className="self-start rounded-full bg-foreground px-4 py-1.5 text-xs font-medium text-background"
        >
          👍 Interested — find shops
        </button>
        {current.phone && (
          <PhoneButton
            phone={current.phone}
            className="self-start rounded-full border border-black/[.08] px-4 py-1.5 text-xs font-medium dark:border-white/[.145]"
          />
        )}
      </div>

      {askingLocation && (
        <div className="flex flex-col gap-2 rounded-lg border border-black/[.08] p-3 text-xs dark:border-white/[.145]">
          <p>Share your location to see nearby shops.</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={useCurrentLocation}
              disabled={locating}
              className="rounded-full border border-black/[.08] px-3 py-1.5 font-medium disabled:opacity-60 dark:border-white/[.145]"
            >
              {locating ? "Locating…" : "📍 Use current location"}
            </button>
            <button
              type="button"
              onClick={() => setPickingOnMap((v) => !v)}
              className="rounded-full border border-black/[.08] px-3 py-1.5 font-medium dark:border-white/[.145]"
            >
              🗺️ Pick on map
            </button>
            <button
              type="button"
              onClick={skipLocation}
              className="rounded-full px-3 py-1.5 font-medium text-zinc-500 underline dark:text-zinc-400"
            >
              Continue without
            </button>
          </div>

          {locationNotice && <p className="text-red-600 dark:text-red-400">{locationNotice}</p>}

          {pickingOnMap && (
            <div className="flex flex-col gap-2">
              <MapPicker
                lat={pickedLat}
                lng={pickedLng}
                onChange={(la, lo) => {
                  setPickedLat(la);
                  setPickedLng(lo);
                }}
                className="h-48 w-full overflow-hidden rounded-lg border border-black/[.08] dark:border-white/[.145]"
              />
              <button
                type="button"
                onClick={confirmMapLocation}
                disabled={pickedLat == null || pickedLng == null}
                className="self-start rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background disabled:cursor-not-allowed disabled:opacity-60"
              >
                Use this location
              </button>
            </div>
          )}
        </div>
      )}

      {search?.loading && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Searching shops…</p>
      )}

      {search?.error && <p className="text-xs text-red-600 dark:text-red-400">{search.error}</p>}

      {search?.matches && (
        <div className="flex flex-col gap-2 rounded-lg border border-black/[.08] p-3 text-xs dark:border-white/[.145]">
          {skippedLocation && (
            <p className="text-amber-700 dark:text-amber-400">
              ⚠️ Showing unsorted matches — share a precise location (map or current location) for
              nearest-first results.
            </p>
          )}
          {search.matches.length === 0 ? (
            <p className="text-zinc-500 dark:text-zinc-400">
              No shops currently stock this — {current.productName}.
            </p>
          ) : (
            search.matches.map((m) => (
              <div key={m.shopId} className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{m.shopName}</p>
                  <p className="text-zinc-500 dark:text-zinc-400">
                    {m.productName} • Kes {m.priceKes}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {m.distanceKm != null && (
                    <span className="text-zinc-500 dark:text-zinc-400">
                      {m.distanceKm.toFixed(1)} km
                    </span>
                  )}
                  {isAuthenticated ? (
                    <form action={createOrderAction} className="flex items-center gap-2">
                      <input type="hidden" name="productId" value={m.productId} />
                      <input type="hidden" name="advertId" value={current.id} />
                      {viewerLat != null && (
                        <input type="hidden" name="latitude" value={viewerLat} />
                      )}
                      {viewerLng != null && (
                        <input type="hidden" name="longitude" value={viewerLng} />
                      )}
                      <input
                        name="quantity"
                        type="number"
                        min="1"
                        defaultValue={1}
                        className="w-12 rounded border border-black/[.08] px-1.5 py-1 dark:border-white/[.145] dark:bg-transparent"
                      />
                      <SubmitButton
                        pendingText="Ordering…"
                        className="rounded-full bg-foreground px-3 py-1 text-xs font-medium text-background"
                      >
                        Order
                      </SubmitButton>
                    </form>
                  ) : (
                    <a
                      href={`/login?callbackUrl=${encodeURIComponent(`${pathname}?${searchParams.toString()}`)}`}
                      className="underline"
                    >
                      Sign in to order
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </>
  );

  if (!sticky) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-black/[.08] bg-zinc-50 p-4 dark:border-white/[.145] dark:bg-zinc-900/40">
        {videoAndLabel}
        {engagement}
      </div>
    );
  }

  return (
    <>
      {/* Sticky mini-player: pinned right below the header (rendered as a
          body-level sibling in layout.tsx, so its containing block spans
          the whole page, not just this component) with a higher z-index
          than ordinary page content, which scrolls underneath it. */}
      <div className="sticky top-14 z-40 border-b border-black/[.08] bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80 dark:border-white/[.145]">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-6 py-3">{videoAndLabel}</div>
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 rounded-b-xl border-x border-b border-black/[.08] bg-zinc-50 px-6 py-4 dark:border-white/[.145] dark:bg-zinc-900/40">
        {engagement}
      </div>
    </>
  );
}
