import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: {
    tsconfigPath: "./tsconfig.json",
  },
  // Explicitly use standalone output to avoid Pages Router error pages
  output: 'standalone',
  // Set the workspace root to silence the warning about multiple lockfiles
  outputFileTracingRoot: path.join(__dirname, '../../'),
  // Ensure proper App Router handling
  experimental: {},
};

export default nextConfig;
