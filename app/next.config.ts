import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this app — otherwise Turbopack tries to infer
  // it and picks up an unrelated package-lock.json in the user's home dir.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
