import { renderAppIcon } from "@/lib/appIcon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  const buffer = await renderAppIcon(180);
  return new Response(new Uint8Array(buffer), {
    headers: { "Content-Type": "image/png" },
  });
}
