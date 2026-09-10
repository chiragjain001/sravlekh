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
  async rewrites() {
    return [
      // NEITHER /api/v1 NOR /api/py is a rewrite, deliberately. Next resolves
      // rewrite destinations during `next build` and freezes them into
      // .next/routes-manifest.json, so `process.env` read here is BUILD-time
      // configuration — an image built without the variable keeps pointing at
      // localhost forever, whatever the container's environment says.
      //
      // Both are proxied at request time instead, by
      // src/app/api/v1/[...path]/route.ts and src/app/api/py/[...path]/route.ts,
      // so one immutable image can be promoted dev -> staging -> production.
      // This rewrites() block is intentionally empty; it is kept so the next
      // person to add one reads this first.
    ];
  },
};

module.exports = nextConfig;
