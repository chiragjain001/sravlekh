import { createProxyRoute } from '@/lib/server/upstream-proxy';

/**
 * Browser -> Python AI/analytics engine.
 *
 * Replaces `aiClient`'s previous `baseURL: 'http://localhost:8000'` — a literal
 * address of the *browser's own machine*, which broke the batch heatmaps, AI
 * blueprint generation and the evaluation-quality dashboard for every user who
 * was not a developer running the engine locally.
 *
 * Shares its implementation with the /api/v1 proxy; see upstream-proxy.ts for
 * why this is a route handler rather than the more obvious next.config.js
 * rewrite. PYTHON_API_URL is server-side only — the engine is reached
 * server-to-server, so it needs neither a public route nor CORS for the
 * browser's origin.
 */
export const { GET, POST, PUT, PATCH, DELETE } = createProxyRoute({
  upstreamBase: () => process.env['PYTHON_API_URL'] ?? 'http://localhost:8000',
  label: 'AI engine',
});

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
