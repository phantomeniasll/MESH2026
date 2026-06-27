import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["38.242.145.157", "bt.xev.dev", "beta.betree.me", "betree.me", "api.betree.me"],
  devIndicators: false,
};

export default nextConfig;
