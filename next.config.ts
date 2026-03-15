import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  serverExternalPackages: ["better-sqlite3", "playwright", "tesseract.js"],
};

export default nextConfig;
