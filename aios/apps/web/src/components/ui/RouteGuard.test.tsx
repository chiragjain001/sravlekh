import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RouteGuard } from './RouteGuard';

/**
 * Route-level role gating.
 *
 * The property that matters is not the redirect — it is that protected children
 * are NEVER rendered for a user who should not see them. A guard that only
 * redirected from an effect would still paint the dashboard for one frame first,
 * which on a slow device is long enough to read, screenshot, or scrape. So every
 * test below asserts on what was rendered, not just on where the user was sent.
 *
 * This is UX-level access control; the server re-validates every request
 * (rbac.ts says so explicitly). A bug here leaks what the UI *shows*, not what
 * the API *returns*.
 */

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

const useAuth = vi.fn();
vi.mock('@/contexts/auth.context', () => ({ useAuth: () => useAuth() }));

const teacher = { id: 'u1', name: 'T', email: 't@x.com', role: 'TEACHER', instituteId: 'i1' };

function renderGuard(allowedRoles: string[] = ['TEACHER']) {
  return render(
    <RouteGuard allowedRoles={allowedRoles as never}>
      <div data-testid="protected">secret dashboard</div>
    </RouteGuard>,
  );
}

describe('RouteGuard', () => {
  beforeEach(() => {
    replace.mockClear();
    useAuth.mockReset();
  });

  it('renders the page for an allowed role', () => {
    useAuth.mockReturnValue({ user: teacher, isLoading: false });

    renderGuard(['TEACHER']);

    expect(screen.getByTestId('protected')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('renders nothing and redirects to /login when signed out', () => {
    useAuth.mockReturnValue({ user: null, isLoading: false });

    renderGuard();

    expect(screen.queryByTestId('protected')).not.toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith('/login');
  });

  it('renders nothing for the wrong role — no flash of protected content', () => {
    // A STUDENT landing on a teacher route. The redirect is secondary; what this
    // pins is that the dashboard markup never reaches the DOM at all.
    useAuth.mockReturnValue({ user: { ...teacher, role: 'STUDENT' }, isLoading: false });

    renderGuard(['TEACHER', 'ADMIN']);

    expect(screen.queryByTestId('protected')).not.toBeInTheDocument();
    expect(screen.queryByText('secret dashboard')).not.toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith('/login?reason=unauthorized');
  });

  it('waits while auth is still loading instead of bouncing the user to /login', () => {
    // The refresh case: on a hard reload `user` is null until the session is
    // restored. Redirecting during loading would log out every user who pressed
    // F5 — so nothing is rendered, and crucially nothing is redirected either.
    useAuth.mockReturnValue({ user: null, isLoading: true });

    renderGuard();

    expect(screen.queryByTestId('protected')).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('admits any role present in allowedRoles, and only those', () => {
    for (const role of ['STUDENT', 'TEACHER', 'ADMIN', 'FOUNDER']) {
      useAuth.mockReturnValue({ user: { ...teacher, role }, isLoading: false });
      const { unmount } = renderGuard(['ADMIN', 'FOUNDER']);

      const allowed = role === 'ADMIN' || role === 'FOUNDER';
      expect(screen.queryByTestId('protected') !== null).toBe(allowed);
      unmount();
    }
  });

  it('does not treat FOUNDER as a wildcard', () => {
    // FOUNDER outranks everyone elsewhere in the product, so it would be easy to
    // assume it passes every guard. It does not: this component is a literal
    // membership test, and a founder-only screen must list FOUNDER explicitly.
    useAuth.mockReturnValue({ user: { ...teacher, role: 'FOUNDER' }, isLoading: false });

    renderGuard(['TEACHER']);

    expect(screen.queryByTestId('protected')).not.toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith('/login?reason=unauthorized');
  });
});
