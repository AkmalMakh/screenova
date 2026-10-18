import path from "node:path";
import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  distDir: process.env.NEXT_BUILD_DIR || ".next",
  outputFileTracingRoot: path.dirname(fileURLToPath(import.meta.url)),
};

// Error reporting is runtime-only: src/instrumentation.ts initializes Sentry and
// src/lib/ops.ts reports. No build wrapper, no source-map upload, no auth token.
export default nextConfig;
