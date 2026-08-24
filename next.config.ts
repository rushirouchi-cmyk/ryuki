import type { NextConfig } from "next";

/*
 * All business dates (shift wall-clock times, daily rollups, "today" on the
 * sales dashboard) are Japan-local. Pinning the process timezone keeps a
 * container running in UTC from silently shifting every bucket by 9 hours.
 */
process.env.TZ = process.env.TZ ?? "Asia/Tokyo";

const nextConfig: NextConfig = {
  typedRoutes: false,
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
};

export default nextConfig;
