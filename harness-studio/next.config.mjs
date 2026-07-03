/** @type {import('next').NextConfig} */
const nextConfig = {
  // better-sqlite3 is a native module used server-side only.
  // Next.js automatically treats node_modules as server externals,
  // so no manual webpack config is needed (and would conflict with Turbopack).
  serverExternalPackages: ['better-sqlite3'],
  experimental: { serverActions: { bodySizeLimit: '10mb' } },
};

export default nextConfig;
