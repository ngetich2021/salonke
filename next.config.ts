import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Product/advert video uploads go through Server Actions; the 1MB
      // default is fine for images but rejects any real video clip.
      bodySizeLimit: "30mb",
    },
  },
};

export default nextConfig;
