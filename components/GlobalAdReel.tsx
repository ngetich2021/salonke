import { auth } from "@/lib/auth";
import { getApprovedAdverts } from "@/lib/dashboard";
import { weightedAdRotation } from "@/lib/campaign";
import { AdvertPlayer } from "@/components/AdvertPlayer";

export async function GlobalAdReel() {
  const [approved, session] = await Promise.all([getApprovedAdverts(), auth()]);
  // Excludes any advert whose paid package has expired, and repeats a paid
  // advert repeatCount+1 times per loop, spaced so repeats never land
  // back-to-back — see lib/campaign.ts. AdvertPlayer just walks whatever
  // flat array it's given, so no changes are needed there.
  const adverts = weightedAdRotation(approved);
  if (adverts.length === 0) return null;

  return (
    <AdvertPlayer
      adverts={adverts.map((advert) => ({
        id: advert.id,
        videoUrl: advert.videoUrl,
        productName: advert.productName,
        serial: advert.serial,
        phone: advert.phone,
      }))}
      isAuthenticated={!!session?.user}
      sticky
    />
  );
}
