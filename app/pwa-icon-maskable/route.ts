import { renderAppIcon } from "@/lib/appIcon";

export async function GET() {
  const buffer = await renderAppIcon(512, { maskable: true });
  return new Response(new Uint8Array(buffer), {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600" },
  });
}
