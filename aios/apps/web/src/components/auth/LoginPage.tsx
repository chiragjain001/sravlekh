'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth.context';
import toast from 'react-hot-toast';
import axios from 'axios';
import { clsx } from 'clsx';

// Google Sign-In type declaration
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
          }) => void;
          renderButton: (
            element: HTMLElement,
            config: {
              theme?: string;
              size?: string;
              width?: number;
              text?: string;
            },
          ) => void;
          prompt: () => void;
        };
      };
    };
  }
}

export function LoginPage() {
  const { login, loginAsMock, user, isLoading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      const dashboardRoutes: Record<string, string> = {
        STUDENT: '/dashboard/student',
        TEACHER: '/dashboard/teacher',
        ADMIN: '/dashboard/admin',
        FOUNDER: '/dashboard/founder',
      };
      router.replace(dashboardRoutes[user.role] ?? '/dashboard');
    }
  }, [user, authLoading, router]);

  // Show session-expired notice
  useEffect(() => {
    if (searchParams.get('reason') === 'session_expired') {
      toast.error('Your session has expired. Please sign in again.');
    }
  }, [searchParams]);

  // Load Google Identity Services script and initialize the button
  useEffect(() => {
    const clientId = process.env['NEXT_PUBLIC_GOOGLE_CLIENT_ID'];
    if (!clientId) {
      console.error('NEXT_PUBLIC_GOOGLE_CLIENT_ID is not configured.');
      return;
    }

    const scriptId = 'google-gsi-script';
    if (document.getElementById(scriptId)) {
      initializeGoogleButton(clientId);
      return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => initializeGoogleButton(clientId);
    document.head.appendChild(script);
  }, []);

  function initializeGoogleButton(clientId: string) {
    window.google?.accounts.id.initialize({
      client_id: clientId,
      callback: handleGoogleCredential,
    });

    const btnEl = document.getElementById('google-signin-btn');
    if (btnEl) {
      window.google?.accounts.id.renderButton(btnEl, {
        theme: 'outline',
        size: 'large',
        width: 320,
        text: 'signin_with',
      });
    }
  }

  async function handleGoogleCredential(response: { credential: string }) {
    setIsSigningIn(true);
    setError(null);

    try {
      await login(response.credential);
      // AuthContext handles navigation on success
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message ??
          'Sign in failed. Please try again.'
        : 'Sign in failed. Please try again.';
      setError(message);
      toast.error(message);
    } finally {
      setIsSigningIn(false);
    }
  }

  // Delegates to AuthContext.loginAsMock — the single mock-session mechanism
  // (previously this wrote directly to localStorage with its own ad-hoc user
  // shape and flipped a global "demo mode" flag that silently mocked every API
  // response; consolidated so there's one dev-only login path, not two).
  function handleDemoLogin(role: 'STUDENT' | 'TEACHER' | 'ADMIN' | 'FOUNDER') {
    setIsSigningIn(true);
    loginAsMock(role);
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div
          className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"
          role="status"
          aria-label="Loading"
        />
      </div>
    );
  }

  return (
    <main
      className="min-h-screen flex flex-col md:flex-row"
      aria-label="AIOS Sign In"
    >
      {/* ── Left panel — Branding ──────────────────────────────────────── */}
      <div
        className="hidden md:flex md:w-1/2 bg-navy-900 flex-col justify-between p-12 text-white"
        aria-hidden="true"
      >
        <div>
          {/* Logo */}
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 bg-teal-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">A</span>
            </div>
            <span className="text-white font-semibold text-xl tracking-tight">
              AIOS
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl font-bold leading-tight mb-4 text-white">
            Academic Intelligence{' '}
            <span className="text-teal-400">Operating System</span>
          </h1>
          <p className="text-navy-200 text-lg leading-relaxed">
            Every test should produce an improvement plan — automatically,
            for the student, the teacher, and the institute.
          </p>
        </div>

        {/* Feature highlights */}
        <ul className="space-y-4" aria-label="Key features">
          {[
            'Marks + meaning, not just a score',
            'Syllabus-aware paper generation',
            'Actionable dashboards and recommendations',
            'Continuous improvement loops',
          ].map((feature) => (
            <li key={feature} className="flex items-center gap-3 text-navy-200">
              <span
                className="w-5 h-5 rounded-full bg-teal-600 flex items-center justify-center flex-shrink-0"
                aria-hidden="true"
              >
                <svg
                  className="w-3 h-3 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </span>
              {feature}
            </li>
          ))}
        </ul>
      </div>

      {/* ── Right panel — Sign in form ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-bg">
        {/* Mobile logo */}
        <div className="flex items-center gap-2 mb-10 md:hidden">
          <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold">A</span>
          </div>
          <span className="text-navy-900 font-semibold text-lg">AIOS</span>
        </div>

        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold text-navy-900 mb-2">
            Welcome back
          </h2>
          <p className="text-navy-500 text-sm mb-8">
            Sign in with your institute Google account to continue.
          </p>

          {/* Google Sign-In button rendered by Google GSI SDK */}
          <div
            id="google-signin-btn"
            className={clsx(
              'w-full mb-4',
              isSigningIn && 'opacity-50 pointer-events-none',
            )}
            aria-label="Sign in with Google"
          />

          {/* Loading state during API call */}
          {isSigningIn && (
            <div className="flex items-center justify-center gap-2 text-navy-500 text-sm mt-2">
              <div
                className="w-4 h-4 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"
                aria-hidden="true"
              />
              <span>Signing you in…</span>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="mt-4 p-3 rounded-lg bg-error-light border border-error text-error-dark text-sm"
            >
              {error}
            </div>
          )}

          <p className="mt-6 text-xs text-navy-400 text-center">
            Access is restricted to pre-approved institute accounts.
            <br />
            If you need access, contact your institute admin.
          </p>

          {/* Dev/test-only mock login — see 06-AUTH-AUTHORIZATION.md ("a mock role-token
              login exists only in non-prod"). Excluded from production bundles. */}
          {process.env.NODE_ENV !== 'production' && (
            <div className="mt-8 border-t border-border pt-6 text-center">
              <p className="text-xs text-navy-500 mb-3">Testing Mode — mock login</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleDemoLogin('STUDENT')}
                  className="btn-secondary text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                >
                  Demo as Student
                </button>
                <button
                  onClick={() => handleDemoLogin('TEACHER')}
                  className="btn-secondary text-xs text-teal-600 border-teal-200 hover:bg-teal-50"
                >
                  Demo as Teacher
                </button>
                <button
                  onClick={() => handleDemoLogin('ADMIN')}
                  className="btn-secondary text-xs text-purple-600 border-purple-200 hover:bg-purple-50"
                >
                  Demo as Admin
                </button>
                <button
                  onClick={() => handleDemoLogin('FOUNDER')}
                  className="btn-secondary text-xs text-warning border-warning hover:bg-yellow-50"
                >
                  Demo as Founder
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
