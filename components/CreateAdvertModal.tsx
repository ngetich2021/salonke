"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Modal, type ModalHandle } from "@/components/Modal";
import { MapPicker } from "@/components/MapPicker";
import { VideoFileInput } from "@/components/VideoFileInput";
import { PaymentPoller } from "@/components/PaymentPoller";
import { extractYouTubeId, youTubeEmbedUrl } from "@/lib/youtube";
import { AD_BASE_RATE_KES, AD_REPEAT_RATE_KES, adCampaignTotalKes } from "@/lib/pricing";

function SubmitAdvertButton({ canSubmit }: { canSubmit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={!canSubmit || pending}
      aria-disabled={!canSubmit || pending}
      className="self-start rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Submitting…" : "Submit for approval"}
    </button>
  );
}

export function CreateAdvertModal({
  action,
  initialLat,
  initialLng,
  initialPhone,
  triggerLabel = "Advertise",
  triggerClassName,
}: {
  action: (formData: FormData) => Promise<{ paymentId: string }>;
  initialLat: number | null;
  initialLng: number | null;
  initialPhone?: string | null;
  triggerLabel?: string;
  triggerClassName?: string;
}) {
  const modalRef = useRef<ModalHandle>(null);
  const [reach, setReach] = useState<"LOCAL" | "GLOBAL">("LOCAL");
  const [lat, setLat] = useState<number | null>(initialLat);
  const [lng, setLng] = useState<number | null>(initialLng);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [videoSource, setVideoSource] = useState<"youtube" | "file">("youtube");
  const [videoUrl, setVideoUrl] = useState("");
  const [packageDays, setPackageDays] = useState(1);
  const [repeatCount, setRepeatCount] = useState(0);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const videoId = extractYouTubeId(videoUrl);
  const totalKes = adCampaignTotalKes(packageDays, repeatCount);

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
      () => setLocationError("Couldn't get your location."),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  const canSubmit = reach === "GLOBAL" || (lat != null && lng != null);

  return (
    <Modal
      ref={modalRef}
      triggerLabel={triggerLabel}
      triggerClassName={triggerClassName}
      title="Advertise a product"
    >
      {paymentId ? (
        <div className="flex flex-col gap-3 text-sm">
          <p>Requesting Kes {totalKes} via M-Pesa — check your phone.</p>
          <PaymentPoller
            paymentId={paymentId}
            // Leaves the "✓ Payment confirmed" message on screen briefly
            // instead of yanking the modal away the instant it lands — an
            // instant close reads as the payment vanishing, not succeeding.
            onSuccess={() => {
              setTimeout(() => modalRef.current?.close(), 1500);
            }}
          />
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
          setSubmitError(null);
          try {
            const result = await action(formData);
            setPaymentId(result.paymentId);
          } catch (err) {
            setSubmitError(err instanceof Error ? err.message : "Something went wrong.");
          }
        }}
        className="flex flex-col gap-3 text-sm"
      >
        <label className="flex flex-col gap-1 text-foreground">
          Product name
          <input
            name="productName"
            required
            className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-transparent"
          />
        </label>

        <label className="flex flex-col gap-1 text-foreground">
          Description (optional)
          <textarea
            name="description"
            className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-transparent"
          />
        </label>

        <label className="flex flex-col gap-1 text-foreground">
          Phone number
          <input
            name="phone"
            type="tel"
            required
            defaultValue={initialPhone ?? ""}
            placeholder="e.g. 07XXXXXXXX"
            className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-transparent"
          />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-semibold text-foreground">Video</legend>
          <label className="flex items-center gap-2 text-foreground">
            <input
              type="radio"
              checked={videoSource === "youtube"}
              onChange={() => setVideoSource("youtube")}
            />
            Paste a YouTube link
          </label>
          <label className="flex items-center gap-2 text-foreground">
            <input
              type="radio"
              checked={videoSource === "file"}
              onChange={() => setVideoSource("file")}
            />
            Upload a video file
          </label>
        </fieldset>

        {videoSource === "youtube" ? (
          <label className="flex flex-col gap-1 text-foreground">
            YouTube video URL
            <input
              name="videoUrl"
              required
              placeholder="https://www.youtube.com/watch?v=..."
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-transparent"
            />
            {videoUrl.trim() && !videoId && (
              <span className="text-red-600 dark:text-red-400">
                Enter a valid YouTube video URL.
              </span>
            )}
          </label>
        ) : (
          <VideoFileInput />
        )}

        {videoSource === "youtube" && videoId && (
          <iframe
            src={youTubeEmbedUrl(videoId)}
            className="aspect-video w-full rounded-lg"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        )}

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-semibold text-foreground">Where should this show?</legend>
          <label className="flex items-center gap-2 text-foreground">
            <input
              type="radio"
              name="reach"
              value="LOCAL"
              checked={reach === "LOCAL"}
              onChange={() => setReach("LOCAL")}
            />
            A specific area
          </label>
          <label className="flex items-center gap-2 text-foreground">
            <input
              type="radio"
              name="reach"
              value="GLOBAL"
              checked={reach === "GLOBAL"}
              onChange={() => setReach("GLOBAL")}
            />
            Everywhere (global)
          </label>
        </fieldset>

        {reach === "LOCAL" && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold text-foreground">Location</span>
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
                setLocationError(null);
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
                Tap the map or use your location so nearby customers can find this ad.
              </p>
            )}
            {locationError && (
              <p className="text-red-600 dark:text-red-400">{locationError}</p>
            )}

            <label className="flex flex-col gap-1 text-foreground">
              Coverage radius, km (optional — leave blank for any distance)
              <input
                name="radiusKm"
                type="number"
                min="1"
                step="1"
                placeholder="e.g. 20"
                className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-transparent"
              />
            </label>
          </div>
        )}

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-semibold text-foreground">Campaign package</legend>
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
            Extra repeats per loop (Kes {AD_REPEAT_RATE_KES}/day each — optional)
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
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Your ad plays once per loop by default; each extra repeat makes it show that many more
            times per loop.
          </p>
          <p className="font-semibold text-foreground">Total: Kes {totalKes}</p>
        </fieldset>

        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          You&apos;ll be prompted for M-Pesa payment on submission. Your ad goes live only after
          payment is confirmed AND an admin approves it.
        </p>

        {submitError && (
          <p className="text-red-600 dark:text-red-400">{submitError}</p>
        )}

        <SubmitAdvertButton canSubmit={canSubmit} />
      </form>
      )}
    </Modal>
  );
}
