/** @type {import('next').NextConfig} */
const r2Hostname = process.env.R2_PUBLIC_URL ? new URL(process.env.R2_PUBLIC_URL).hostname : null;

const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.notion.so',
      },
      {
        protocol: 'https',
        hostname: '**.amazonaws.com',
      },
      ...(r2Hostname ? [{ protocol: 'https', hostname: r2Hostname }] : []),
    ],
  },
}

module.exports = nextConfig
