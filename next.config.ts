import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['pg'],
  typedRoutes: false,
};

export default nextConfig;
