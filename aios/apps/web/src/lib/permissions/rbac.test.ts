import { describe, expect, it } from 'vitest';
import { hasPermission, hasAllPermissions, hasAnyPermission, getPermissionsForRole } from './rbac';

describe('rbac', () => {
  it('grants ADMIN permission to grade a test', () => {
    expect(hasPermission('ADMIN', 'test:grade')).toBe(true);
  });

  it('does not grant STUDENT permission to grade a test', () => {
    expect(hasPermission('STUDENT', 'test:grade')).toBe(false);
  });

  it('getPermissionsForRole is consistent with hasPermission for every permission', () => {
    const studentPermissions = getPermissionsForRole('STUDENT');
    for (const permission of studentPermissions) {
      expect(hasPermission('STUDENT', permission)).toBe(true);
    }
  });

  it('hasAllPermissions requires every permission to be granted', () => {
    expect(hasAllPermissions('TEACHER', ['test:create', 'test:grade'])).toBe(true);
    expect(hasAllPermissions('STUDENT', ['test:read', 'test:grade'])).toBe(false);
  });

  it('hasAnyPermission requires at least one permission to be granted', () => {
    expect(hasAnyPermission('STUDENT', ['test:read', 'test:grade'])).toBe(true);
    expect(hasAnyPermission('STUDENT', ['test:create', 'test:grade'])).toBe(false);
  });
});
