const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emit a self-contained server (.next/standalone) holding only the files the
  // app actually imports, traced at build time. The runtime image then ships
  // that instead of the whole pnpm node_modules tree — which was most of its
  // 1.34 GB, and included Prisma, its engines and packages/db despite no web
  // source file importing @aios/db.
  //
  // OPT-IN via NEXT_OUTPUT_STANDALONE=1, set by infra/docker/web.Dockerfile. Not
  // unconditional because producing the standalone tree means recreating pnpm's
  // symlinks, and Windows refuses to create symlinks without Developer Mode or
  // admin rights: an unconditional setting made `pnpm build` FAIL outright on a
  // Windows dev machine (EPERM: operation not permitted, symlink ...). Linux —
  // the Docker build and CI — has no such restriction.
  ...(process.env.NEXT_OUTPUT_STANDALONE === '1' && {
    output: 'standalone',
    // Monorepo: trace from the workspace root, or pnpm's hoisted packages outside
    // apps/web are missed and the standalone server fails at startup with
    // "Cannot find module".
    outputFileTracingRoot: path.join(__dirname, '../../'),
  }),
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
