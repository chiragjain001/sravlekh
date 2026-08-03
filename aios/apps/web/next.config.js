/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow cross-origin images from Google avatars and S3
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: '*.amazonaws.com' },
    ],
  },
  // Proxy API requests to the NestJS backend in development
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/v1/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
