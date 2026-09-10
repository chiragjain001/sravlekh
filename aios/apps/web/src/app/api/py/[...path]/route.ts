import { NextRequest, NextResponse } from 'next/server';

/**
 * Runtime proxy from the browser to the Python AI/analytics engine.
 *
 * WHY A ROUTE HANDLER AND NOT A next.config.js REWRITE:
 * a rewrite looks like it reads its destination from the environment, but Next
 * evaluates `rewrites()` during `next build` and freezes the resolved string into
 * `.next/routes-manifest.json`. Verified by reading that file out of a built
 * image: the entry was a literal `http://localhost:8000/:path*`, and the running
 * container logged `Failed to proxy http://localhost:8000/... ECONNREFUSED`
 * despite PYTHON_API_URL being set on the container. `process.env` inside
 * next.config.js is build-time configuration wearing runtime clothes.
 *
 * A route handler reads `process.env` on each request, so one image can be
 * promoted from staging to production and pointed at a different engine by
 * changing an environment variable — which is the property that was wanted.
 *
 * This replaces `aiClient`'s previous `baseURL: 'http://localhost:8000'`, a
 * literal address of the *browser's own machine* that broke the batch heatmaps,
 * AI blueprint generation and the evaluation-quality dashboard for every user
 * who was not a developer running the engine locally.
 *
 * NOTE the engine is reached server-to-server from here, so it does not need to
 * be publicly routable or CORS-configured for the browser's origin.
 */

// The engine's address is server-side configuration and deliberately NOT
// NEXT_PUBLIC_: the browser has no reason to learn where it lives.
const ENGINE_URL = () => process.env['PYTHON_API_URL'] ?? 'http://localhost:8000';

// Hop-by-hop and host-specific headers must not be forwarded: `host` would point
// the engine at the web origin, and the encoding/length headers describe a body
// fetch() re-encodes itself.
const STRIPPED_REQUEST_HEADERS = new Set([
  'host',
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'content-length',
  'accept-encoding',
]);

const STRIPPED_RESPONSE_HEADERS = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'content-encoding',
  'content-length',
]);

async function proxy(request: NextRequest, path: string[]): Promise<Response> {
  // path segments come from the URL and are re-encoded here rather than
  // concatenated raw, so a segment cannot smuggle `../` or a query string into
  // the upstream URL.
  const suffix = path.map(encodeURIComponent).join('/');
  const target = new URL(`${ENGINE_URL()}/${suffix}`);
  target.search = request.nextUrl.search;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!STRIPPED_REQUEST_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  });

  // GET/HEAD must not carry a body — fetch rejects it outright.
  const method = request.method;
  const hasBody = method !== 'GET' && method !== 'HEAD';

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      // Never follow a redirect on the engine's behalf: it would let a
      // misconfigured or compromised engine steer this server (which is holding
      // the caller's Authorization header) at an arbitrary host.
      redirect: 'manual',
      cache: 'no-store',
    });
  } catch (error) {
    // The engine being down is an expected operational state, not a bug in this
    // handler. Report it as an upstream failure and keep the reason in the
    // server log rather than the response body — the message can name internal
    // hostnames and ports.
    console.error(`[api/py] upstream request to the AI engine failed: ${String(error)}`);
    return NextResponse.json(
      { success: false, detail: 'The AI engine is unavailable. Please try again.' },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!STRIPPED_RESPONSE_HEADERS.has(key.toLowerCase())) responseHeaders.set(key, value);
  });

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

// Next 15 passes route params as a Promise.
type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  return proxy(request, (await ctx.params).path);
}
export async function POST(request: NextRequest, ctx: Ctx) {
  return proxy(request, (await ctx.params).path);
}
export async function PATCH(request: NextRequest, ctx: Ctx) {
  return proxy(request, (await ctx.params).path);
}
export async function PUT(request: NextRequest, ctx: Ctx) {
  return proxy(request, (await ctx.params).path);
}
export async function DELETE(request: NextRequest, ctx: Ctx) {
  return proxy(request, (await ctx.params).path);
}

// This route is a live proxy — it must never be prerendered or cached.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
