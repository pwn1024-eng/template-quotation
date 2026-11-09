/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['jszip', '@prisma/client', 'prisma'],
  devIndicators: false,
};

export default nextConfig;
