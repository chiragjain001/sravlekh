import type { UserRole } from './db.types';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  instituteId: string;
  avatarUrl?: string;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthenticatedUser;
}
