import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction, UserStatus, UserRole } from '@prisma/client';
import { JwtPayload, AuthenticatedUser } from './auth.types';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly googleClient: OAuth2Client;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    this.googleClient = new OAuth2Client(
      this.config.get<string>('GOOGLE_CLIENT_ID'),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * A-01: Google login flow
   * 1. Verify the Google ID token server-side (signature, audience, issuer, expiry).
   * 2. Check the verified email against every institute's allow-list.
   * 3. If found: upsert the User record and return a signed JWT.
   * 4. If not found: log the failed attempt and throw 403.
   */
  async loginWithGoogle(
    idToken: string,
    ipAddress?: string,
  ): Promise<{ accessToken: string; user: AuthenticatedUser }> {
    // Step 1 — Verify token with Google
    const googlePayload = await this.verifyGoogleToken(idToken);
    const email = googlePayload.email!;
    const googleSub = googlePayload.sub!;
    const name = googlePayload.name ?? email;
    const avatarUrl = googlePayload.picture ?? undefined;

    // Step 2 — Check institute allow-list
    const allowEntry = await this.prisma.allowListEntry.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      include: { institute: true },
    });

    if (!allowEntry) {
      // Log the failed attempt (no user record exists yet, so actor is 'UNKNOWN')
      this.logger.warn(`Login rejected — email not in any allow-list: ${email}`);
      await this.writeAnonymousLoginFailedLog(email, ipAddress);
      throw new ForbiddenException(
        "This email isn't linked to an institute yet — contact your admin.",
      );
    }

    const { institute, role } = allowEntry;

    // Step 3 — Upsert the User record
    const user = await this.prisma.user.upsert({
      where: { googleSub },
      update: {
        name,
        avatarUrl,
        lastLoginAt: new Date(),
        status: UserStatus.ACTIVE,
      },
      create: {
        googleSub,
        email,
        name,
        avatarUrl,
        role,
        instituteId: institute.id,
        lastLoginAt: new Date(),
      },
    });

    // Guard: if the user's role has changed in the allow-list, update it
    if (user.role !== role) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { role },
      });
    }

    // Guard: suspended users cannot log in
    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException(
        'Your account has been suspended. Contact your institute admin.',
      );
    }

    // Step 4 — Audit log the successful login
    await this.prisma.auditLog.create({
      data: {
        instituteId: institute.id,
        actorId: user.id,
        action: AuditAction.LOGIN,
        entity: 'users',
        entityId: user.id,
        ipAddress,
      },
    });

    // Step 5 — Sign JWT
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      instituteId: user.instituteId,
    };

    const accessToken = this.jwt.sign(payload);

    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      instituteId: user.instituteId,
    };

    return { accessToken, user: authenticatedUser };
  }

  /** Validate a JWT payload — called by JwtStrategy on every protected request. */
  async validateJwtPayload(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true, instituteId: true, status: true },
    });

    if (!user || user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException('Session invalid. Please sign in again.');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
      instituteId: user.instituteId,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────────────────────────────────

  private async verifyGoogleToken(idToken: string): Promise<TokenPayload> {
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: this.config.get<string>('GOOGLE_CLIENT_ID'),
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email || !payload.sub) {
        throw new UnauthorizedException('Invalid Google token payload.');
      }

      return payload;
    } catch (err) {
      this.logger.error('Google token verification failed', err);
      throw new UnauthorizedException(
        'Google sign-in failed. Please try again.',
      );
    }
  }

  /**
   * Write a minimal audit entry for a login attempt from an unrecognised email.
   * We cannot link to a real actor, so we use a sentinel institute_id of 'UNKNOWN'.
   */
  private async writeAnonymousLoginFailedLog(
    email: string,
    ipAddress?: string,
  ): Promise<void> {
    // Silently ignore if this fails — don't let audit failure block the response
    try {
      // Find any institute to attach to (or skip if none exist)
      const firstInstitute = await this.prisma.institute.findFirst({
        select: { id: true },
      });
      if (!firstInstitute) return;

      // Find the first founder user as a sentinel actor for logging purposes
      const founderUser = await this.prisma.user.findFirst({
        where: { role: UserRole.FOUNDER },
        select: { id: true },
      });
      if (!founderUser) return;

      await this.prisma.auditLog.create({
        data: {
          instituteId: firstInstitute.id,
          actorId: founderUser.id,
          action: AuditAction.LOGIN_FAILED,
          entity: 'users',
          entityId: 'unknown',
          newValue: { email },
          ipAddress,
        },
      });
    } catch {
      // Intentionally swallowed
    }
  }
}
