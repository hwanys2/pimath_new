import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@hwanys2/pm-board"],
  // Forum posts allow up to 5×4MB images; keep headroom for Workers FormData.
  experimental: {
    serverActions: {
      bodySizeLimit: "24mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.yes24.com",
        pathname: "/goods/**",
      },
    ],
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;

import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();

