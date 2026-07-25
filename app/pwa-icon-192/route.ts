import { renderAppIcon } from "@/lib/appIcon";

export async function GET() {
  const buffer = await renderAppIcon(192);
  return new Response(new Uint8Array(buffer), {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600" },
  });
}
