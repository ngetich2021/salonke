const YOUTUBE_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;

// Accepts a bare video ID or any common YouTube URL shape (watch, youtu.be,
// embed, shorts, live) and returns the 11-char video ID, or null if the
// input isn't a recognizable YouTube video.
export function extractYouTubeId(input: string): string | null {
  const trimmed = input.trim();
  if (YOUTUBE_ID_PATTERN.test(trimmed)) return trimmed;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\.|^m\./, "");

  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return YOUTUBE_ID_PATTERN.test(id) ? id : null;
  }

  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") {
      const id = url.searchParams.get("v");
      return id && YOUTUBE_ID_PATTERN.test(id) ? id : null;
    }
    const match = url.pathname.match(/^\/(embed|shorts|live)\/([a-zA-Z0-9_-]{11})/);
    if (match) return match[2];
  }

  return null;
}

// Used only for the static advertiser-side preview (CreateAdvertModal); the
// public reel uses YouTubePlayer instead, since a plain iframe src can't
// report playback state back to the page for auto-advance.
export function youTubeEmbedUrl(id: string): string {
  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
  });
  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
}
