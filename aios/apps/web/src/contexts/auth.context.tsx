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
import { DEFAULT_PERMISSIONS_BY_ROLE } from '@/lib/permissions/rbac';
import { DEMO_FEATURE_FLAGS } from '@/lib/feature-flags';
import type { AcademicSession, BranchConfig, InstituteConfig, FeatureFlags } from '@/types/academic-context.types';

const DEMO_SESSION: AcademicSession = {
  id: '2025-26', label: 'Academic Year 2025-26',
  startDate: '2025-04-01', endDate: '2026-03-31', isActive: true,
};

const DEMO_BRANCH_CONFIG: Pick<BranchConfig, 'name' | 'city' | 'timezone' | 'activeExams'> = {
  name: 'Ahmedabad Main Branch', city: 'Ahmedabad',
  timezone: 'Asia/Kolkata', activeExams: ['jee-main', 'neet-ug'],
};

const DEMO_INSTITUTE_CONFIG: Pick<InstituteConfig, 'name' | 'type' | 'logo' | 'theme' | 'activeExams'> = {
  name: 'Sarvlekh Academy', type: 'COACHING', logo: null,
  theme: { primaryColor: '#4f46e5', secondaryColor: '#7c3aed', logoUrl: null },
  activeExams: [],
};

const MOCK_USERS: Record<string, AuthenticatedUser> = {
  STUDENT: {
    id: 'mock-student-001', email: 'aryan@aios.test', name: 'Aryan Sharma',
    role: 'STUDENT', avatarUrl: undefined, avatarInitials: 'AS',
    instituteId: 'inst-001', branchId: 'branch-001', sessionId: '2025-26',
    studentId: 'STU-002',
    permissions: DEFAULT_PERMISSIONS_BY_ROLE['STUDENT'],
    featureFlags: DEMO_FEATURE_FLAGS,
    instituteConfig: DEMO_INSTITUTE_CONFIG,
    branchConfig: DEMO_BRANCH_CONFIG,
    activeSessions: [DEMO_SESSION],
  },
  TEACHER: {
    id: 'mock-teacher-001', email: 'rahul@aios.test', name: 'Rahul Verma',
    role: 'TEACHER', avatarUrl: undefined, avatarInitials: 'RV',
    instituteId: 'inst-001', branchId: 'branch-001', sessionId: '2025-26',
    teacherId: 'TCH-2023-042',
    permissions: DEFAULT_PERMISSIONS_BY_ROLE['TEACHER'],
    featureFlags: DEMO_FEATURE_FLAGS,
    instituteConfig: DEMO_INSTITUTE_CONFIG,
    branchConfig: DEMO_BRANCH_CONFIG,
    activeSessions: [DEMO_SESSION],
  },
  ADMIN: {
    id: 'mock-admin-001', email: 'neha@aios.test', name: 'Neha Malhotra',
    role: 'ADMIN', avatarUrl: undefined, avatarInitials: 'NM',
    instituteId: 'inst-001', branchId: 'branch-001', sessionId: '2025-26',
    permissions: DEFAULT_PERMISSIONS_BY_ROLE['ADMIN'],
    featureFlags: DEMO_FEATURE_FLAGS,
    instituteConfig: DEMO_INSTITUTE_CONFIG,
    branchConfig: DEMO_BRANCH_CONFIG,
    activeSessions: [DEMO_SESSION],
  },
  FOUNDER: {
    id: 'mock-founder-001', email: 'admin@aios.platform', name: 'Super Admin',
    role: 'FOUNDER', avatarUrl: undefined, avatarInitials: 'SA',
    instituteId: 'platform', branchId: 'platform', sessionId: '2025-26',
    permissions: DEFAULT_PERMISSIONS_BY_ROLE['FOUNDER'],
    featureFlags: DEMO_FEATURE_FLAGS,
    instituteConfig: DEMO_INSTITUTE_CONFIG,
    branchConfig: DEMO_BRANCH_CONFIG,
    activeSessions: [DEMO_SESSION],
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
