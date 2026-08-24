import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: false,
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
};

export default nextConfig;
