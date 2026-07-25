// Cloudinary serves an auto-generated video thumbnail when the same
// delivery URL is requested with an image extension instead of the
// original video one — no extra upload or API call needed.
export function cloudinaryVideoThumbnail(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith("res.cloudinary.com")) return null;
  } catch {
    return null;
  }
  return url.replace(/\.[a-zA-Z0-9]+(\?.*)?$/, ".jpg");
}

export function youTubeThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}
