"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    YT?: {
      Player: new (
        el: HTMLElement,
        opts: {
          videoId: string;
          width?: string | number;
          height?: string | number;
          host?: string;
          playerVars?: Record<string, number>;
          events?: {
            onReady?: () => void;
            onStateChange?: (event: { data: number }) => void;
          };
        }
      ) => {
        destroy: () => void;
        mute: () => void;
        unMute: () => void;
        playVideo: () => void;
        loadVideoById: (videoId: string) => void;
        getPlayerState: () => number;
      };
      PlayerState: { ENDED: number; PLAYING: number; BUFFERING: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

// How long a video may sit off-PLAYING (blocked autoplay, stuck buffering,
// network stall) before the watchdog below reloads it once, and then how
// long the reload gets before it gives up and skips to the next ad.
const STALL_TIMEOUT_MS = 8000;

let apiPromise: Promise<void> | null = null;

// The plain `<iframe src="youtube.com/embed/...">` used before is
// cross-origin and never tells the parent page when playback ends — there's
// no onEnded to hook, unlike a native <video>. The official IFrame Player
// API (loaded once, reused across every player on the page) is the only way
// to get a real "video ended" event so the reel can auto-advance.
function loadYouTubeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  });
  return apiPromise;
}

export function YouTubePlayer({
  videoId,
  playKey,
  muted,
  onEnded,
  className,
}: {
  videoId: string;
  // Identifies *which advance this is* (AdvertPlayer passes its `index`),
  // independent of videoId — the ad rotation can legitimately play the same
  // video twice in a row (a single approved ad, or a paid repeat landing
  // next to itself), and videoId alone wouldn't change in that case, so the
  // reload-and-replay effects below key off this instead. See the swap
  // effect further down for why relying on videoId directly silently
  // stopped a repeated ad from ever playing again.
  playKey: number;
  muted: boolean;
  onEnded: () => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onEndedRef = useRef(onEnded);
  const playerRef = useRef<{
    destroy: () => void;
    mute: () => void;
    unMute: () => void;
    playVideo: () => void;
    loadVideoById: (videoId: string) => void;
    getPlayerState: () => number;
  } | null>(null);
  // Read once, at the very first mount of this (now long-lived) component —
  // only used to seed the player's initial video/mute state, never touched
  // again, so it's safe outside the creation effect's dependency array.
  //
  // AdvertPlayer defaults `muted` to false, so the very first ad of a
  // session can hit the browser's no-prior-gesture autoplay block. A blocked
  // unmuted autoplay leaves this sitting on the first frame with no visible
  // way to start it (native controls and clicks are both deliberately
  // disabled below) — the stall watchdog further down is what actually
  // recovers it, by muting before its reload retry once a video has gone
  // genuinely too long without reaching PLAYING (as opposed to just being
  // slow to buffer, which reaching PLAYING a little late doesn't warrant
  // muting for).
  const initialRef = useRef({ videoId, muted });

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  // Reacts to the mute toggle for the currently-mounted player. The initial
  // mute state at creation (below) is what lets the *next* video start
  // already unmuted once the viewer has unmuted once this session.
  useEffect(() => {
    if (muted) {
      playerRef.current?.mute();
    } else {
      playerRef.current?.unMute();
    }
  }, [muted]);

  // Read in the interaction listener below via a ref (not the `muted` prop
  // directly) so the listener can stay a single, stable subscription for
  // the component's whole lifetime instead of re-attaching on every mute
  // toggle.
  const mutedRef = useRef(muted);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  // Recovers real sound the moment the visitor interacts with the page at
  // all. The stall watchdog further down force-mutes the player when a
  // blocked unmuted autoplay would otherwise leave it frozen — but that's a
  // direct call on the player itself, not a change to AdvertPlayer's own
  // `muted` state (which stays exactly as the viewer left it), so nothing
  // else ever tells the player to unmute again once the browser's
  // user-gesture restriction is actually satisfied.
  //
  // This listener stays attached for the component's whole lifetime (not
  // just the first interaction) because the watchdog can force-mute more
  // than once in a single session — a backgrounded tab, a network stall, or
  // (via a full top-level navigation like the Google OAuth round-trip)
  // this whole component remounting from scratch can each trigger it again
  // later on. Gated on `mutedRef.current === false` (the viewer's actual,
  // last-chosen preference) so it only ever recoups a *system*-forced mute
  // and never fights a deliberate press of the 🔇 button — the guard reads
  // fresh on every event via the ref above, not a stale closure.
  useEffect(() => {
    function onInteraction() {
      if (mutedRef.current) return;
      playerRef.current?.unMute();
      playerRef.current?.playVideo();
    }
    window.addEventListener("pointerdown", onInteraction);
    window.addEventListener("keydown", onInteraction);
    return () => {
      window.removeEventListener("pointerdown", onInteraction);
      window.removeEventListener("keydown", onInteraction);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let player: {
      destroy: () => void;
      mute: () => void;
      unMute: () => void;
      playVideo: () => void;
      loadVideoById: (videoId: string) => void;
      getPlayerState: () => number;
    } | null = null;

    // YT.Player replaces its target element with an <iframe> in place. If
    // that target were the div React itself renders (containerRef.current),
    // React would later try to unmount a node YouTube already swapped out
    // from under it, throwing "removeChild: not a child of this node". So
    // YT.Player is instead given a plain child div, created and owned
    // outside of React's reconciliation, nested inside the div React does
    // manage — only that inner, React-oblivious node ever gets replaced.
    const mountPoint = document.createElement("div");
    mountPoint.style.width = "100%";
    mountPoint.style.height = "100%";

    loadYouTubeApi().then(() => {
      if (cancelled || !containerRef.current || !window.YT) return;
      containerRef.current.appendChild(mountPoint);
      player = new window.YT.Player(mountPoint, {
        // Without explicit width/height, YT.Player falls back to its
        // classic 640x390 default and ignores the container's CSS entirely
        // — these percentages let the generated iframe fill containerRef
        // instead of bursting out of it.
        width: "100%",
        height: "100%",
        videoId: initialRef.current.videoId,
        // Privacy-enhanced domain: same behavior, fewer YouTube tracking
        // cookies dropped in the viewer's browser (matches youTubeEmbedUrl's
        // static preview, which already uses this host).
        host: "https://www.youtube-nocookie.com",
        playerVars: {
          autoplay: 1,
          mute: initialRef.current.muted ? 1 : 0,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          // Native controls are redundant — AdvertPlayer overlays its own
          // mute/find-shops/prev-next buttons — and leaving them enabled is
          // what lets a stray tap pause the video and trigger YouTube's
          // branded "pause card" (channel avatar, subscriber count, related
          // videos) over the ad.
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          cc_load_policy: 0,
        },
        events: {
          // The object `new YT.Player(...)` returns exists immediately, but
          // its methods (getPlayerState, loadVideoById, mute/unMute) aren't
          // wired up until YouTube's postMessage bridge to the iframe
          // finishes connecting — calling them before that throws "is not a
          // function". `playerRef.current` is only ever set here, once
          // that's actually true.
          onReady: () => {
            if (!cancelled) playerRef.current = player;
          },
          onStateChange: (event) => {
            if (event.data === window.YT!.PlayerState.ENDED) {
              onEndedRef.current();
            }
          },
        },
      });
    });

    return () => {
      cancelled = true;
      playerRef.current = null;
      player?.destroy();
    };
    // Mount-once: this component now stays mounted for the whole reel
    // (AdvertPlayer no longer remounts it per ad via `key`), so the player
    // itself must persist too — recreating the iframe per ad is what made
    // "unmuted" autoplay get silently re-blocked on every video after the
    // first (a fresh cross-origin iframe re-triggers the browser's autoplay
    // check from scratch). Video changes are handled by the effect below,
    // which reuses this same player/iframe via `loadVideoById` instead.
  }, []);

  // Skips the initial mount (that video is already the one passed to
  // `new YT.Player(...)` above) and, on every subsequent advance, swaps the
  // video within the SAME player/iframe instead of tearing it down — this
  // is what actually carries the unmuted, user-activated state forward from
  // one ad to the next. Keyed on `playKey` (not `videoId`): when the same
  // ad plays twice in a row, `videoId` is the identical string on both
  // renders, so a `[videoId]` dependency would never fire again and the
  // video would just sit at ENDED forever instead of restarting.
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    playerRef.current?.loadVideoById(videoId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playKey]);

  // Watchdog: a video that never reaches PLAYING (autoplay blocked, network
  // stall) or drops out of it for too long gets reloaded once via the same
  // `loadVideoById` used above (the "reentered" retry); if it's still not
  // playing after that, skip to the next ad through the same `onEnded` path
  // used for natural end-of-video — no parallel skip mechanism.
  //
  // The reload retry also mutes first. A blocked *unmuted* autoplay is what
  // this whole 8s-of-non-PLAYING signal most often actually is (ordinary
  // buffering is essentially never this slow), and reloading with the exact
  // same unmuted request would just get blocked again — muting first is
  // what makes the retry actually succeed. Muted state only changes here at
  // the player level, not through AdvertPlayer's own `muted` state, so the
  // 🔊 button still shows what the viewer would expect; the pointerdown/
  // keydown listener above is what restores real sound the moment the
  // browser's user-gesture requirement is actually satisfied.
  useEffect(() => {
    let sinceMs = Date.now();
    let reloaded = false;

    const interval = setInterval(() => {
      const player = playerRef.current;
      if (!player || !window.YT) return;

      if (player.getPlayerState() === window.YT.PlayerState.PLAYING) {
        sinceMs = Date.now();
        reloaded = false;
        return;
      }

      if (Date.now() - sinceMs <= STALL_TIMEOUT_MS) return;

      if (!reloaded) {
        reloaded = true;
        sinceMs = Date.now();
        player.mute();
        player.loadVideoById(videoId);
      } else {
        clearInterval(interval);
        onEndedRef.current();
      }
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playKey]);

  return (
    <div
      ref={containerRef}
      // pointer-events-none: this is an autoplay reel, not a scrubbable
      // player — clicks were the only way the pause card (branding,
      // subscriber count, related videos) could appear. The sibling
      // mute/find-shops/prev-next buttons in AdvertPlayer sit in normal
      // stacking siblings, so they're unaffected and still clickable.
      className={`relative overflow-hidden pointer-events-none ${className ?? ""}`}
    />
  );
}
