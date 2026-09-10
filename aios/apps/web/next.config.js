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
      // NOTE: /api/py is deliberately NOT a rewrite. Next resolves rewrite
      // destinations during `next build` and freezes them into
      // .next/routes-manifest.json, so `process.env` here is build-time config —
      // an image built without PYTHON_API_URL keeps pointing at localhost:8000 no
      // matter what the container's environment says. It is proxied at request
      // time instead by src/app/api/py/[...path]/route.ts.
      //
      // The /api/v1 rewrite above has the same build-time constraint: whatever
      // NEXT_PUBLIC_API_URL is set to at build time is what the image will always
      // use. web.Dockerfile therefore declares it as a build ARG. Moving it to a
      // route handler as well would make one image promotable across
      // environments — worth doing, but it is the primary data path and deserves
      // its own change and review rather than riding along here.
    ];
  },
};

module.exports = nextConfig;
