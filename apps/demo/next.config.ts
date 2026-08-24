import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

// Next runs this workspace package from apps/demo. Load the monorepo-level
// environment files so local credentials stay in the single ignored root file.
loadEnvConfig(projectRoot);

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  // Browser tests run beside the local demo. Give them an isolated output
  // directory so a production build or second dev server cannot invalidate the
  // active app's module graph.
  distDir: process.env.FIFY_NEXT_DIST_DIR?.trim() || ".next",
  turbopack: { root: projectRoot },
  transpilePackages: [
    "@fify/a2ui",
    "@fify/core",
    "@fify/mcp-app",
    "@fify/react",
  ],
};

export default nextConfig;
