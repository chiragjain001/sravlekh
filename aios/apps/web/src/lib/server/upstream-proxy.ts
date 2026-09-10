import { NextRequest, NextResponse } from 'next/server';

/**
 * Server-side reverse proxy from the browser to a backend service.
 *
 * WHY THIS EXISTS AT ALL — next.config.js rewrites look like they read their
 * destination from the environment, and they do not. Next evaluates `rewrites()`
 * during `next build` and freezes the resolved string into
 * `.next/routes-manifest.json`. Verified by reading that file out of a built
 * image: the entry was a literal `http://localhost:8000/:path*`, and a container
 * with the environment variable set correctly still logged
 * `Failed to proxy http://localhost:8000/... ECONNREFUSED`.
 *
 * The consequence is that a rewrite-based deployment needs one image PER
 * environment, and an image promoted from staging to production silently keeps
 * calling staging. A route handler reads `process.env` on every request, so one
 * immutable image can be promoted across dev, staging and production and pointed
 * at different backends purely by environment.
 *
 * Everything here is streamed. The document upload endpoint accepts 60 files at
 * 10 MB each (documents.controller.ts), so a proxy that buffered request bodies
 * would hold up to 600 MB of a single booklet in the web server's heap and turn
 * a normal upload into an OOM. Request and response bodies are both passed
 * through as streams and never materialised.
 */

/**
 * Hop-by-hop headers (RFC 9110 §7.6.1) plus the ones that describe a body this
 * proxy is re-framing. Forwarding `host` would tell the backend it was reached
 * at the web origin; forwarding `content-length` or `content-encoding` would
 * describe the original body rather than the one fetch actually sends.
 */
const STRIPPED_REQUEST_HEADERS = new Set([
  'host',
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'content-length',
  // Let undici negotiate its own encoding with the upstream rather than
  // promising the browser's preferences on a connection we then re-frame.
  'accept-encoding',
  // `Expect: 100-continue` is per-hop and belongs to the client<->proxy
  // conversation, not the proxy<->upstream one. Forwarding it is not merely
  // untidy: undici REFUSES the request outright with
  // `NotSupportedError: expect header not supported`.
  //
  // Found by proxying a 25 MB upload — curl (and other clients) add this header
  // automatically once a body is large enough, so the failure hit exactly the
  // booklet-upload path this proxy streams for, and nothing smaller. The client
  // saw a 502 with no explanation.
  'expect',
]);

const STRIPPED_RESPONSE_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  // The body is decoded by undici before it reaches us, so passing these on
  // would tell the browser to decode something already decoded.
  'content-encoding',
  'content-length',
]);

/**
 * Statuses that MUST NOT carry a body. Constructing a Response with a body and
 * one of these throws a TypeError at runtime, which would turn a perfectly good
 * upstream 204 into a 500 from the proxy.
 */
const NULL_BODY_STATUS = new Set([204, 205, 304]);

export type ProxyOptions = {
  /** Base URL of the upstream service, read per request from process.env. */
  upstreamBase: string;
  /** Path segments captured by the [...path] route. */
  path: string[];
  /** Prefix the upstream expects, e.g. "/api/v1". Empty for none. */
  upstreamPrefix?: string;
  /** Short name used in logs and the failure body. */
  label: string;
};

/**
 * Thrown when a request cannot be mapped to a safe upstream URL. Handled by the
 * caller as a 400 — it is a malformed request, not an upstream failure.
 */
class UnsafePathError extends Error {}

function buildTargetUrl(request: NextRequest, { upstreamBase, path, upstreamPrefix = '' }: ProxyOptions): URL {
  // Reject traversal segments OUTRIGHT rather than trying to encode them away.
  //
  // encodeURIComponent was the original defence here and it is not sufficient:
  // it does not escape dots, so a `..` segment survives it unchanged and the URL
  // constructor then resolves the traversal. Caught by the test below —
  // `['..', '..', 'admin', 'secrets']` against prefix `/api/v1` produced
  // `/admin/secrets`, escaping the prefix entirely and letting a caller reach
  // paths on the internal host that this proxy is not meant to expose.
  //
  // Encoding is still applied for everything else (`?`, `#`, `/` inside a
  // segment), but the traversal case is rejected, because "encode it and hope
  // the normaliser agrees" is a weaker property than "this cannot be expressed".
  for (const segment of path) {
    if (segment === '.' || segment === '..' || segment === '') {
      throw new UnsafePathError(`Illegal path segment: ${JSON.stringify(segment)}`);
    }
  }

  const suffix = path.map(encodeURIComponent).join('/');
  const target = new URL(`${upstreamBase}${upstreamPrefix}/${suffix}`);

  // Belt and braces: whatever the segments were, the resolved path must still sit
  // under the prefix we intended. A future change to the encoding above cannot
  // silently reopen the hole without failing here.
  const base = new URL(upstreamBase);
  const expectedPrefix = `${base.pathname.replace(/\/$/, '')}${upstreamPrefix}/`;
  if (!target.pathname.startsWith(expectedPrefix)) {
    throw new UnsafePathError(`Resolved path ${target.pathname} escapes ${expectedPrefix}`);
  }

  // Assigning .search rather than merging: the query belongs to the caller and
  // is passed through whole.
  target.search = request.nextUrl.search;
  return target;
}

export async function proxyToUpstream(request: NextRequest, options: ProxyOptions): Promise<Response> {
  let target: URL;
  try {
    target = buildTargetUrl(request, options);
  } catch (error) {
    if (error instanceof UnsafePathError) {
      // 400, not 502: the request itself is malformed, and nothing was sent
      // upstream. The reason stays in the log — echoing it back would confirm
      // to a prober exactly which shapes are rejected.
      console.warn(`[proxy:${options.label}] rejected unsafe path: ${error.message}`);
      return NextResponse.json({ success: false, message: 'Invalid request path.' }, { status: 400 });
    }
    throw error;
  }

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!STRIPPED_REQUEST_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  });

  // GET/HEAD must not carry a body — fetch rejects the combination outright.
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      // Streamed, not buffered — see this module's header for why that matters
      // at 600 MB. `duplex: 'half'` is required by the spec whenever body is a
      // stream, and is not yet in the TS DOM lib, hence the cast.
      body: hasBody ? request.body : undefined,
      ...(hasBody ? ({ duplex: 'half' } as Record<string, unknown>) : {}),
      // Never follow a redirect on the caller's behalf: this server is holding
      // their Authorization header and cookies, and an upstream 3xx could
      // otherwise steer it at an arbitrary host.
      redirect: 'manual',
      cache: 'no-store',
    });
  } catch (error) {
    // An unreachable backend is an expected operational state, not a bug here.
    // The reason goes to the server log — it can name internal hostnames and
    // ports — while the caller gets a stable, uninformative 502.
    console.error(
      `[proxy:${options.label}] upstream request failed: ${String(error)}` +
        (error instanceof Error && error.cause ? ` | cause: ${String(error.cause)}` : ''),
    );
    return NextResponse.json(
      { success: false, message: `The ${options.label} service is unavailable. Please try again.` },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!STRIPPED_RESPONSE_HEADERS.has(key.toLowerCase())) responseHeaders.set(key, value);
  });

  // Set-Cookie is the one header that legitimately repeats, and Headers.forEach
  // collapses repeats into a single comma-joined value — which corrupts cookie
  // attributes (Expires contains a comma). getSetCookie() is the only API that
  // returns them intact, so they are re-appended individually. This is
  // load-bearing for auth: a login that sets both a session and a refresh cookie
  // would otherwise deliver one malformed cookie and no session.
  responseHeaders.delete('set-cookie');
  for (const cookie of upstream.headers.getSetCookie()) {
    responseHeaders.append('set-cookie', cookie);
  }

  return new NextResponse(NULL_BODY_STATUS.has(upstream.status) ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

/**
 * Builds the five method handlers a [...path] route needs.
 *
 * `upstreamBase` is a function, not a string: it must be read from the
 * environment on every request, which is the entire point of this file. Reading
 * it once at module scope would reintroduce the build-time freezing described in
 * the header, just one layer down.
 */
export function createProxyRoute(config: {
  upstreamBase: () => string;
  upstreamPrefix?: string;
  label: string;
}) {
  type Ctx = { params: Promise<{ path: string[] }> };

  const handler = async (request: NextRequest, ctx: Ctx) => {
    const { path } = await ctx.params; // Next 15 passes params as a Promise
    return proxyToUpstream(request, {
      upstreamBase: config.upstreamBase(),
      upstreamPrefix: config.upstreamPrefix ?? '',
      path,
      label: config.label,
    });
  };

  return {
    GET: handler,
    POST: handler,
    PUT: handler,
    PATCH: handler,
    DELETE: handler,
  };
}
