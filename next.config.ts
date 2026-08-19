import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    "preview-chat-237be223-cc8d-4887-aac8-8c8d67ef7d45.space-z.ai",
    "*.space-z.ai",
  ],
};

export default nextConfig;
