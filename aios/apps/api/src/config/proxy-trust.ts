/**
 * AIOS / SARVLEKH — Fastify Reverse Proxy Trust Resolution
 *
 * Resolves trusted proxy addresses for Fastify to prevent client IP spoofing
 * while ensuring accurate client IP tracking for rate limiting (UserThrottlerGuard).
 *
 * Security Invariants:
 * 1. Never trust arbitrary X-Forwarded-For headers from untrusted clients (no wildcard true in production).
 * 2. In production, requires explicit loopback, IP addresses, or CIDR ranges.
 * 3. Supports local reverse proxies (Nginx/Caddy) via 'loopback'.
 * 4. Supports cloud load balancers / VPC subnets via CIDR blocks (e.g. '172.26.0.0/16').
 */

export type TrustProxyConfig = boolean | string | string[];

export function resolveTrustProxy(
  rawTrustProxy: string | undefined,
  nodeEnv: string | undefined,
): TrustProxyConfig {
  if (!rawTrustProxy || rawTrustProxy.trim() === '' || rawTrustProxy === 'false') {
    return false;
  }

  const trimmed = rawTrustProxy.trim();

  if (trimmed === 'true') {
    if (nodeEnv === 'production') {
      throw new Error(
        'SECURITY VIOLATION: TRUST_PROXY=true is unsafe in production because it blindly trusts ' +
        'unverified X-Forwarded-For headers from any remote client. ' +
        'Specify explicit trusted proxy addresses, CIDRs (e.g. "127.0.0.1,172.26.0.0/16"), or "loopback".',
      );
    }
    return true;
  }

  // Predefined Fastify/proxy-addr aliases
  if (trimmed === 'loopback' || trimmed === 'linklocal' || trimmed === 'uniquelocal') {
    return trimmed;
  }

  // Split comma-separated list of IPs or CIDRs
  const entries = trimmed
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);

  if (entries.length === 0) {
    return false;
  }

  const first = entries[0];
  if (entries.length === 1 && first) {
    return first;
  }

  return entries;
}

