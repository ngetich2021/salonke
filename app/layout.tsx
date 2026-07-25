import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { GlobalAdReel } from "@/components/GlobalAdReel";
import { InactivityLogout } from "@/components/InactivityLogout";
import { VisitTracker } from "@/components/VisitTracker";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { InstallAppButton } from "@/components/InstallAppButton";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SalonKE",
  description: "Find nearby salons and beauty shops.",
  appleWebApp: {
    capable: true,
    title: "SalonKE",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#1d2226",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <meta name="color-scheme" content="light dark" />
        <link rel="preconnect" href="https://i.ytimg.com" />
        <link rel="preconnect" href="https://www.youtube-nocookie.com" />
      </head>
      <body className="min-h-full flex flex-col">
        <ServiceWorkerRegister />
        <InstallAppButton />
        <InactivityLogout />
        <Suspense fallback={null}>
          <VisitTracker />
        </Suspense>
        <Header />
        {/* Rendered as a direct body sibling (not nested in a short wrapper
            div) so AdvertPlayer's sticky top strip sticks for the full page
            scroll — position:sticky is bound to its parent's box, and body
            spans the whole page. See AdvertPlayer for the split into a
            sticky strip + normal-flow panel underneath it. */}
        <Suspense fallback={null}>
          <GlobalAdReel />
        </Suspense>
        <main className="flex flex-1 flex-col">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
