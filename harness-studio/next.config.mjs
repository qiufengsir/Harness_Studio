/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // better-sqlite3 is a native module used server-side only.
  serverExternalPackages: ['better-sqlite3'],
  experimental: { serverActions: { bodySizeLimit: '10mb' } },
};

export default nextConfig;
