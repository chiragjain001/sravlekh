import { HttpException, HttpStatus } from '@nestjs/common';
import { InstituteBulkThrottleGuard } from './institute-bulk-throttle.guard';

function mockContext(instituteId: string) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ params: { instituteId } }) }),
  } as any;
}

describe('InstituteBulkThrottleGuard (07-SECURITY-SPECIFICATION.md §7)', () => {
  let guard: InstituteBulkThrottleGuard;

  beforeEach(() => {
    guard = new InstituteBulkThrottleGuard();
  });

  it('allows requests under the limit', () => {
    for (let i = 0; i < 50; i++) {
      expect(guard.canActivate(mockContext('inst-1'))).toBe(true);
    }
  });

  it('rejects the request once an institute exceeds its hourly limit', () => {
    for (let i = 0; i < 50; i++) guard.canActivate(mockContext('inst-1'));

    expect(() => guard.canActivate(mockContext('inst-1'))).toThrow(HttpException);
    try {
      guard.canActivate(mockContext('inst-1'));
    } catch (err) {
      expect((err as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
  });

  it('tracks each institute independently — one institute maxing out never blocks another', () => {
    for (let i = 0; i < 50; i++) guard.canActivate(mockContext('inst-1'));
    expect(() => guard.canActivate(mockContext('inst-1'))).toThrow(HttpException);

    expect(guard.canActivate(mockContext('inst-2'))).toBe(true);
  });
});
