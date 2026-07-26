"use client";

import { useEffect, useRef } from "react";

// How long a video is allowed to make no progress before it's considered
// stalled — mirrors the YouTubePlayer watchdog's threshold so both ad
// sources escalate (reload once, then skip) on a comparable timescale.
const STALL_TIMEOUT_MS = 8000;

export function FallbackVideoPlayer({
  src,
  playKey,
  poster,
  muted,
  onEnded,
  className,
}: {
  src: string;
  // Identifies *which advance this is* (AdvertPlayer passes its `index`) —
  // see the swap effect below for why this player stays mounted for the
  // whole reel instead of being recreated per ad via a React `key`. Also
  // what makes a repeated ad (same src twice in a row — a single approved
  // ad, or a paid repeat landing next to itself) actually restart instead
  // of sitting frozen at its ended frame, since `src` alone wouldn't change
  // in that case.
  playKey: number;
  poster?: string | null;
  muted: boolean;
  onEnded: () => void;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onEndedRef = useRef(onEnded);
  const reloadedRef = useRef(false);
  // 0 is a placeholder — the effect below sets this to Date.now() on mount,
  // before the watchdog interval ever runs, so the initial value is never
  // read for real (Date.now() itself can't be called during render).
  const lastProgressRef = useRef(0);
  const didMountRef = useRef(false);

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  // The `autoPlay` attribute's own unmuted-autoplay attempt fails silently
  // when the browser blocks it (no prior user gesture on the page yet) —
  // unlike YouTube's embed, a native <video> has no built-in fallback, so
  // without this it just sits frozen on the first ad of a session forever.
  // Muting the element directly (not the `muted` prop/React state) is the
  // minimal recovery that gets it actually playing; the parent's mute
  // state — and the 🔊 button — stay exactly as the viewer left them.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.play().catch(() => {
      video.muted = true;
      video.play().catch(() => {});
    });
    // Mount-once: only the very first ad can hit a no-prior-gesture block —
    // once the page has any interaction, subsequent `loadVideoById`-style
    // swaps in the effect below play unmuted without issue.
  }, []);

  // Read in the interaction listener below via a ref (not the `muted` prop
  // directly) so the listener can stay a single, stable subscription for
  // the component's whole lifetime instead of re-attaching on every mute
  // toggle.
  const mutedRef = useRef(muted);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  // Recovers real sound the moment the visitor interacts with the page at
  // all. The two direct `video.muted = true` fallbacks above and in
  // handleStall below force-mute the element itself when a blocked
  // unmuted autoplay would otherwise leave it frozen — but that's outside
  // AdvertPlayer's own `muted` state (which stays exactly as the viewer
  // left it), so nothing else ever tells the element to unmute again once
  // the browser's user-gesture restriction is actually satisfied.
  //
  // Stays attached for the component's whole lifetime (not just the first
  // interaction) because a stall — and the force-mute that follows it —
  // can happen more than once in a single session (a backgrounded tab, a
  // network hiccup, or a full top-level navigation like the Google OAuth
  // round-trip remounting this component from scratch). Gated on
  // `mutedRef.current === false` (the viewer's actual, last-chosen
  // preference), read fresh via the ref on every event, so this only ever
  // recoups a *system*-forced mute and never fights a deliberate press of
  // the 🔇 button.
  useEffect(() => {
    function onInteraction() {
      if (mutedRef.current) return;
      const video = videoRef.current;
      if (!video) return;
      video.muted = false;
      video.play().catch(() => {});
    }
    window.addEventListener("pointerdown", onInteraction);
    window.addEventListener("keydown", onInteraction);
    return () => {
      window.removeEventListener("pointerdown", onInteraction);
      window.removeEventListener("keydown", onInteraction);
    };
  }, []);

  // Skips the initial mount (the `src` attribute + `autoPlay` below already
  // handle that first play) and, on every subsequent advance, plays the
  // current `src` in the SAME <video> element instead of remounting it —
  // mirrors YouTubePlayer's approach, for the same reason: a fresh element
  // re-triggers the browser's autoplay-with-sound policy from scratch,
  // which is what silently forced every ad after the first back to muted
  // (or blocked outright) when this used to remount via a React `key` on
  // every single ad change.
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    video.src = src;
    video.currentTime = 0;
    video.load();
    video.play().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playKey]);

  // First stall/wait/error for this src: reload it in place (the "reentered"
  // retry), muting first. 8 seconds of no progress is most often a blocked
  // *unmuted* autoplay (ordinary buffering is essentially never this slow),
  // and reloading with the exact same unmuted request would just get
  // blocked again — muting first is what makes the retry actually succeed.
  // Only at the element level, not AdvertPlayer's own `muted` state, so the
  // 🔊 button still shows what the viewer would expect; the pointerdown/
  // keydown listener above is what restores real sound once the browser's
  // user-gesture requirement is actually satisfied. A second stall — or
  // continued silent non-progress caught by the watchdog below — skips to
  // the next ad via the same path AdvertPlayer already uses for natural
  // end-of-video.
  function handleStall() {
    if (!reloadedRef.current) {
      reloadedRef.current = true;
      lastProgressRef.current = Date.now();
      const video = videoRef.current;
      if (video) {
        video.muted = true;
        video.currentTime = 0;
        video.load();
        video.play().catch(() => {});
      }
    } else {
      onEndedRef.current();
    }
  }

  function markProgress() {
    lastProgressRef.current = Date.now();
  }

  // `onStalled`/`onWaiting`/`onError` don't fire for every way playback can
  // silently stop advancing, so this watchdog re-checks actual progress
  // (via markProgress, updated on `onTimeUpdate`/`onPlaying`) independently
  // of whether the browser raised any event at all.
  useEffect(() => {
    reloadedRef.current = false;
    lastProgressRef.current = Date.now();
    const interval = setInterval(() => {
      if (Date.now() - lastProgressRef.current > STALL_TIMEOUT_MS) {
        handleStall();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [playKey]);

  return (
    <video
      ref={videoRef}
      src={src}
      poster={poster ?? undefined}
      autoPlay
      muted={muted}
      controls
      playsInline
      onTimeUpdate={markProgress}
      onPlaying={markProgress}
      onStalled={handleStall}
      onWaiting={handleStall}
      onError={handleStall}
      onEnded={() => onEndedRef.current()}
      className={className}
    />
  );
}
