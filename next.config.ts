import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@hwanys2/pm-board"],
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

