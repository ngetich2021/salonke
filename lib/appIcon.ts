import sharp from "sharp";
import path from "node:path";

// Pre-cropped square emblem (just the pin/face/rose mark, no wordmark) cut
// from public/salonke.png — the full lockup includes "SALONKE / BEAUTY ON
// DEMAND" text that's illegible at icon sizes (32px favicon, etc.), so
// every generated icon size is derived from this mark instead of the full
// logo file.
const SOURCE_PATH = path.join(process.cwd(), "public", "salonke-icon.png");

// Sampled from the logo's own background corner — used as the maskable
// icon's padding fill so the safe-zone border matches the mark's backdrop
// instead of introducing a mismatched flat color.
const BACKGROUND = "#1d2226";

export async function renderAppIcon(
  size: number,
  { maskable = false }: { maskable?: boolean } = {}
): Promise<Buffer> {
  if (!maskable) {
    return sharp(SOURCE_PATH).resize(size, size).png().toBuffer();
  }

  // Android's adaptive/maskable icons crop to a circle (or other shapes) by
  // default, cutting off anything near the edge — content has to stay
  // inside the inner ~safe zone, so the mark is shrunk and centered on a
  // full-bleed background instead of resized to fill the whole canvas.
  const inner = Math.round(size * 0.6);
  const mark = await sharp(SOURCE_PATH).resize(inner, inner).png().toBuffer();

  return sharp({
    create: { width: size, height: size, channels: 4, background: BACKGROUND },
  })
    .composite([{ input: mark, gravity: "center" }])
    .png()
    .toBuffer();
}
