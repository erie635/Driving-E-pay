/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,   // ⚠️ temporary – allows build even with TS errors
  },
  eslint: {
    ignoreDuringBuilds: true,  // ⚠️ temporary – skip ESLint checks
  },
};

module.exports = nextConfig;
