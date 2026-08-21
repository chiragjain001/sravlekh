import { UserRole } from '@prisma/client';

/**
 * Shape of the JWT payload stored in the session token.
 * Typed explicitly so every guard and decorator is consistent.
 */
export interface JwtPayload {
  sub: string;        // User.id (CUID)
  email: string;
  name: string;
  role: UserRole;
  instituteId: string;
  iat?: number;
  exp?: number;
}

/**
 * The authenticated user object attached to every protected request.
 * Accessible via @CurrentUser() decorator.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  instituteId: string;
  avatarUrl?: string | null;
}
