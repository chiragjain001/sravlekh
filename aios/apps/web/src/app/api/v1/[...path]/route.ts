import { createProxyRoute } from '@/lib/server/upstream-proxy';

/**
 * Browser -> NestJS API.
 *
 * This replaces the `/api/v1/:path*` rewrite that was in next.config.js. The
 * rewrite worked, but its destination was resolved at BUILD time and frozen into
 * .next/routes-manifest.json, so `NEXT_PUBLIC_API_URL` had to be correct when
 * the image was built and could never be changed afterwards. That meant one
 * image per environment, and an image promoted from staging to production would
 * have gone on quietly calling the staging API.
 *
 * Read per request here, so a single immutable image runs in dev, staging and
 * production and is pointed at the right API purely by environment.
 *
 * API_URL is server-side only and deliberately not NEXT_PUBLIC_: the browser
 * talks to this origin, never to the API directly. NEXT_PUBLIC_API_URL is still
 * honoured as a fallback so an existing deployment that only sets that keeps
 * working rather than silently falling back to localhost.
 */
export const { GET, POST, PUT, PATCH, DELETE } = createProxyRoute({
  upstreamBase: () =>
    process.env['API_URL'] ?? process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000',
  upstreamPrefix: '/api/v1',
  label: 'API',
});

// A live proxy: never prerendered, never cached.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
