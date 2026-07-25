import { renderAppIcon } from "@/lib/appIcon";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default async function Icon() {
  const buffer = await renderAppIcon(32);
  return new Response(new Uint8Array(buffer), {
    headers: { "Content-Type": "image/png" },
  });
}
