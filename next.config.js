/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['localhost'],
    unoptimized: false,
  },
  // Enable standalone output for better Docker/Railway deployment
  output: 'standalone',
}

module.exports = nextConfig

