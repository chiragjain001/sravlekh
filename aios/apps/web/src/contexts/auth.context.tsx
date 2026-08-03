'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import type { AuthenticatedUser } from '@/types/auth.types';

// ── Types ──────────────────────────────────────────────────────────────────────

interface AuthContextValue {
  user: AuthenticatedUser | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (idToken: string) => Promise<void>;
  loginAsMock: (role: 'STUDENT' | 'TEACHER' | 'ADMIN' | 'FOUNDER') => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'aios_access_token';
const USER_KEY  = 'aios_user';

// ── Mock users for test mode ───────────────────────────────────────────────────

const MOCK_USERS: Record<string, AuthenticatedUser> = {
  STUDENT: {
    id: 'mock-student-001',
    email: 'aryan@aios.test',
    name: 'Aryan Sharma',
    role: 'STUDENT',
    instituteId: 'inst-001',
    avatarUrl: undefined,
  },
  TEACHER: {
    id: 'mock-teacher-001',
    email: 'rahul@aios.test',
    name: 'Rahul Verma',
    role: 'TEACHER',
    instituteId: 'inst-001',
    avatarUrl: undefined,
  },
  ADMIN: {
    id: 'mock-admin-001',
    email: 'neha@aios.test',
    name: 'Neha Malhotra',
    role: 'ADMIN',
    instituteId: 'inst-001',
    avatarUrl: undefined,
  },
  FOUNDER: {
    id: 'mock-founder-001',
    email: 'admin@aios.platform',
    name: 'Super Admin',
    role: 'FOUNDER',
    instituteId: 'platform',
    avatarUrl: undefined,
  },
};

// ── Provider ───────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser]               = useState<AuthenticatedUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading]     = useState(true);

  // Rehydrate from localStorage on mount
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      const storedUser  = localStorage.getItem(USER_KEY);
      if (storedToken && storedUser) {
        setAccessToken(storedToken);
        setUser(JSON.parse(storedUser) as AuthenticatedUser);
      }
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Mock login for testing — bypasses real auth.
   * Sets a fake user in localStorage and redirects to the correct dashboard.
   */
  const loginAsMock = useCallback(
    (role: 'STUDENT' | 'TEACHER' | 'ADMIN' | 'FOUNDER') => {
      const mockUser  = MOCK_USERS[role];
      const mockToken = `mock-token-${role.toLowerCase()}-${Date.now()}`;

      localStorage.setItem(TOKEN_KEY, mockToken);
      localStorage.setItem(USER_KEY, JSON.stringify(mockUser));
      setAccessToken(mockToken);
      setUser(mockUser ?? null);

      const routes: Record<string, string> = {
        STUDENT: '/dashboard/student',
        TEACHER: '/dashboard/teacher',
        ADMIN:   '/dashboard/admin',
        FOUNDER: '/dashboard/founder',
      };
      router.push(routes[role] ?? '/login');
    },
    [router],
  );

  /**
   * Real Google SSO login — used in production.
   */
  const login = useCallback(
    async (_idToken: string) => {
      // In test mode — always succeed with a mock
      // In production, replace with real API call to /auth/google
      console.warn('Real auth not configured. Use loginAsMock() for testing.');
    },
    [],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setAccessToken(null);
    setUser(null);
    router.push('/login');
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, accessToken, isLoading, login, loginAsMock, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ────────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
