import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SalonKE — Find nearby salons and beauty shops",
    short_name: "SalonKE",
    description: "Find nearby salons and beauty shops, order products and services, and browse local ads.",
    start_url: "/",
    display: "standalone",
    // Matches the logo's own background (public/salonke.png) so the splash
    // screen and icon read as one continuous piece instead of a color seam.
    background_color: "#1d2226",
    theme_color: "#1d2226",
    icons: [
      { src: "/pwa-icon-192", sizes: "192x192", type: "image/png" },
      { src: "/pwa-icon-512", sizes: "512x512", type: "image/png" },
      { src: "/pwa-icon-maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
