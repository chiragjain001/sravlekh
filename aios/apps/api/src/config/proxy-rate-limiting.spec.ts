import { UserThrottlerGuard } from '../shared/guards/user-throttler.guard';

describe('UserThrottlerGuard & Proxy Rate Limiting Invariants', () => {
  let guard: UserThrottlerGuard;

  beforeEach(() => {
    // Construct UserThrottlerGuard with mock dependencies to test tracker key generation
    guard = new (class extends UserThrottlerGuard {
      public exposeTracker(req: Record<string, any>): Promise<string> {
        return this.getTracker(req);
      }
    })({} as any, {} as any, {} as any);
  });

  describe('Authenticated user rate limiting', () => {
    it('uses req.user.id for authenticated requests regardless of client IP or proxy header', async () => {
      const req = {
        user: { id: 'user-teacher-uuid', instituteId: 'inst-1' },
        ip: '127.0.0.1',
        ips: ['127.0.0.1', '203.0.113.195'],
      };

      const tracker = await (guard as any).exposeTracker(req);
      expect(tracker).toBe('user-teacher-uuid');
    });

    it('throttles the same user account across multiple IPs (prevents distributed brute force)', async () => {
      const reqFromIp1 = {
        user: { id: 'user-admin-1', instituteId: 'inst-1' },
        ip: '198.51.100.1',
      };
      const reqFromIp2 = {
        user: { id: 'user-admin-1', instituteId: 'inst-1' },
        ip: '198.51.100.2',
      };

      const tracker1 = await (guard as any).exposeTracker(reqFromIp1);
      const tracker2 = await (guard as any).exposeTracker(reqFromIp2);

      // Same account must share the rate-limiting tracker
      expect(tracker1).toBe(tracker2);
      expect(tracker1).toBe('user-admin-1');
    });

    it('isolates different authenticated users who share the same institute NAT/proxy IP', async () => {
      // Common classroom scenario: 30 students submitting from the same institute public IP
      const reqStudentA = {
        user: { id: 'student-uuid-aaa', instituteId: 'inst-1' },
        ip: '103.21.244.15', // Same institute gateway IP
      };
      const reqStudentB = {
        user: { id: 'student-uuid-bbb', instituteId: 'inst-1' },
        ip: '103.21.244.15', // Same institute gateway IP
      };

      const trackerA = await (guard as any).exposeTracker(reqStudentA);
      const trackerB = await (guard as any).exposeTracker(reqStudentB);

      // Legitimate students must have separate rate-limiting buckets
      expect(trackerA).not.toBe(trackerB);
      expect(trackerA).toBe('student-uuid-aaa');
      expect(trackerB).toBe('student-uuid-bbb');
    });
  });

  describe('Public / unauthenticated rate limiting (login & token refresh)', () => {
    it('falls back to req.ip when req.user is undefined', async () => {
      const req = {
        user: undefined,
        ip: '203.0.113.50',
      };

      const tracker = await (guard as any).exposeTracker(req);
      expect(tracker).toBe('203.0.113.50');
    });

    it('ensures distinct public clients hitting /auth/login or /auth/refresh have separate trackers', async () => {
      const reqAttacker = {
        user: undefined,
        ip: '198.51.100.77',
      };
      const reqLegitimateTeacher = {
        user: undefined,
        ip: '203.0.113.88',
      };

      const trackerAttacker = await (guard as any).exposeTracker(reqAttacker);
      const trackerLegitimate = await (guard as any).exposeTracker(reqLegitimateTeacher);

      expect(trackerAttacker).not.toBe(trackerLegitimate);
      expect(trackerAttacker).toBe('198.51.100.77');
      expect(trackerLegitimate).toBe('203.0.113.88');
    });

    it('tracks the real forwarded IP when behind trusted reverse proxy', async () => {
      // In Fastify with trustProxy configured, req.ip is set to the client IP forwarded by Nginx
      const req = {
        user: undefined,
        ip: '203.0.113.195', // Nginx set this via X-Forwarded-For: $remote_addr
      };

      const tracker = await (guard as any).exposeTracker(req);
      expect(tracker).toBe('203.0.113.195');
    });
  });
});
