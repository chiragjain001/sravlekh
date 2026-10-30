import { UserThrottlerGuard } from '../shared/guards/user-throttler.guard';

describe('UserThrottlerGuard & Proxy IP Resolution', () => {
  let guard: UserThrottlerGuard;

  beforeEach(() => {
    // Construct UserThrottlerGuard (options/storage injected as mocks or dummy for tracker tests)
    guard = new (class extends UserThrottlerGuard {
      public exposeTracker(req: Record<string, any>): Promise<string> {
        return this.getTracker(req);
      }
    })({} as any, {} as any, {} as any);
  });

  it('uses req.user.id for authenticated requests regardless of client IP', async () => {
    const req = {
      user: { id: 'teacher-uuid-123', instituteId: 'inst-1' },
      ip: '127.0.0.1',
      ips: ['127.0.0.1', '203.0.113.1'],
    };

    const tracker = await (guard as any).exposeTracker(req);
    expect(tracker).toBe('teacher-uuid-123');
  });

  it('falls back to req.ip for unauthenticated requests', async () => {
    const req = {
      user: undefined,
      ip: '203.0.113.50',
    };

    const tracker = await (guard as any).exposeTracker(req);
    expect(tracker).toBe('203.0.113.50');
  });

  it('ensures two distinct public clients do not share tracker keys when real client IP is resolved', async () => {
    const reqClientA = {
      user: undefined,
      ip: '203.0.113.10',
    };
    const reqClientB = {
      user: undefined,
      ip: '203.0.113.20',
    };

    const trackerA = await (guard as any).exposeTracker(reqClientA);
    const trackerB = await (guard as any).exposeTracker(reqClientB);

    expect(trackerA).not.toBe(trackerB);
    expect(trackerA).toBe('203.0.113.10');
    expect(trackerB).toBe('203.0.113.20');
  });
});

