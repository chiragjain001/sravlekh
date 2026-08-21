import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth.module';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

/**
 * Regression test for a bug found during the v2 kickoff (docs/33-GAP-ANALYSIS-AND-BUILD-PLAN.md):
 * JwtAuthGuard and RolesGuard were fully implemented and every route decorated with
 * @Roles()/@Public(), but neither guard was ever registered as a global APP_GUARD —
 * so no request was actually authenticated or authorized at runtime. This asserts the
 * module metadata that fix depends on, so the guards can never silently go unregistered
 * again without a failing test.
 */
describe('AuthModule', () => {
  it('registers JwtAuthGuard and RolesGuard as global APP_GUARD providers', () => {
    const providers = Reflect.getMetadata('providers', AuthModule) as unknown[];

    const appGuardProviders = providers.filter(
      (p): p is { provide: unknown; useClass: unknown } =>
        typeof p === 'object' && p !== null && 'provide' in p && (p as { provide: unknown }).provide === APP_GUARD,
    );

    const guardClasses = appGuardProviders.map((p) => p.useClass);
    expect(guardClasses).toContain(JwtAuthGuard);
    expect(guardClasses).toContain(RolesGuard);

    // Order matters: authentication must run before authorization.
    expect(guardClasses.indexOf(JwtAuthGuard)).toBeLessThan(guardClasses.indexOf(RolesGuard));
  });
});
