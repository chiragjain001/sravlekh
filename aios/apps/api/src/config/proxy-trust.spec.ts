import { resolveTrustProxy } from './proxy-trust';

describe('resolveTrustProxy', () => {
  it('returns false when unset, empty, or set to "false"', () => {
    expect(resolveTrustProxy(undefined, 'development')).toBe(false);
    expect(resolveTrustProxy('', 'production')).toBe(false);
    expect(resolveTrustProxy('   ', 'production')).toBe(false);
    expect(resolveTrustProxy('false', 'production')).toBe(false);
  });

  it('allows "true" only in non-production environments', () => {
    expect(resolveTrustProxy('true', 'development')).toBe(true);
    expect(resolveTrustProxy('true', 'staging')).toBe(true);
    expect(() => resolveTrustProxy('true', 'production')).toThrow(
      /SECURITY VIOLATION: TRUST_PROXY=true is unsafe in production/,
    );
  });

  it('supports predefined aliases like "loopback"', () => {
    expect(resolveTrustProxy('loopback', 'production')).toBe('loopback');
    expect(resolveTrustProxy('linklocal', 'production')).toBe('linklocal');
  });

  it('parses a single IP or CIDR', () => {
    expect(resolveTrustProxy('127.0.0.1', 'production')).toBe('127.0.0.1');
    expect(resolveTrustProxy('172.26.0.0/16', 'production')).toBe('172.26.0.0/16');
  });

  it('parses multiple comma-separated IPs and CIDRs into an array', () => {
    const result = resolveTrustProxy('127.0.0.1, 172.26.0.0/16, 10.0.0.0/8', 'production');
    expect(result).toEqual(['127.0.0.1', '172.26.0.0/16', '10.0.0.0/8']);
  });

  it('correctly parses Docker bridge network CIDRs alongside loopback for multi-container deployments', () => {
    const result = resolveTrustProxy('172.28.0.0/16, 127.0.0.1', 'production');
    expect(result).toEqual(['172.28.0.0/16', '127.0.0.1']);
  });
});

