import {
  Controller,
  Post,
  Body,
  Get,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { GoogleLoginDto } from './dto/google-login.dto';
import { DevLoginDto } from './dto/dev-login.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthenticatedUser } from './auth.types';
import { REFRESH_TOKEN_TTL_DAYS } from './refresh-token.service';

/**
 * The refresh token travels ONLY in this cookie — never in a response body.
 *
 * A body is readable by page JavaScript, so putting it there would hand it to
 * any XSS on the page, which is precisely the exposure the refresh mechanism
 * exists to remove. httpOnly means script cannot read it at all.
 */
const REFRESH_COOKIE = 'aios_refresh_token';

/**
 * Path-scoped to the auth routes, so the browser sends this cookie only to the
 * endpoints that need it rather than on every API call. It is then absent from
 * the headers of hundreds of unrelated requests, where a proxy log or an error
 * reporter could otherwise capture it.
 */
const REFRESH_COOKIE_PATH = '/api/v1/auth';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private setRefreshCookie(res: Response, token: string, isProduction: boolean) {
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      // Only over TLS in production. Not unconditionally, or local http:// dev
      // would silently drop the cookie and every login would look broken.
      secure: isProduction,
      // 'strict' rather than 'lax'. This cookie authorises minting a new
      // session, so it should never ride along on a cross-site navigation —
      // which closes the CSRF path on the refresh endpoint itself.
      sameSite: 'strict',
      path: REFRESH_COOKIE_PATH,
      maxAge: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    });
  }

  private clearRefreshCookie(res: Response, isProduction: boolean) {
    // Attributes must match the ones it was set with, or the browser treats it
    // as a different cookie and the old one survives the logout.
    res.clearCookie(REFRESH_COOKIE, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: REFRESH_COOKIE_PATH,
    });
  }

  private get isProduction(): boolean {
    return process.env['NODE_ENV'] === 'production';
  }

  /**
   * A-01: POST /api/v1/auth/google
   * Accepts a Google ID token from the client and returns a signed JWT.
   */
  @Public()
  @Post('google')
  @HttpCode(HttpStatus.OK)
  // 07-SECURITY-SPECIFICATION.md §7: 10 req/s + 100 req/min per IP on the login
  // endpoint specifically — pinned explicitly rather than relying on it happening
  // to match today's global default, so a future change to the global throttler
  // can't silently weaken this endpoint's protection.
  @Throttle({ short: { limit: 10, ttl: 1000 }, medium: { limit: 100, ttl: 60_000 } })
  @ApiOperation({ summary: 'Sign in with Google' })
  async loginWithGoogle(
    @Body() dto: GoogleLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ipAddress = req.ip ?? req.socket.remoteAddress;
    const result = await this.authService.loginWithGoogle(dto.idToken, ipAddress, {
      userAgent: req.headers['user-agent'] ?? null,
      ipAddress: ipAddress ?? null,
    });

    this.setRefreshCookie(res, result.refreshToken, this.isProduction);

    // refreshToken and refreshExpiresAt are stripped deliberately: the cookie is
    // the only place the token is allowed to exist. The rest of the body shape is
    // unchanged, so existing clients keep working.
    const { refreshToken: _rt, refreshExpiresAt: _re, ...body } = result;
    return body;
  }

  /**
   * 06-AUTH-AUTHORIZATION.md §1: dev/test-only mock login, disabled in production
   * (enforced in AuthService, not just here — see loginAsMockRole).
   */
  @Public()
  @Post('dev-login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'DEV ONLY: sign in as a seeded mock user by role' })
  async devLogin(@Body() dto: DevLoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.loginAsMockRole(dto.role);
    this.setRefreshCookie(res, result.refreshToken, this.isProduction);
    const { refreshToken: _rt, refreshExpiresAt: _re, ...body } = result;
    return body;
  }

  /**
   * GET /api/v1/auth/me
   * Returns the currently authenticated user (validates JWT is still live).
   */
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  /**
   * POST /api/v1/auth/refresh — exchange the refresh cookie for a new access
   * token, rotating the refresh token in the process.
   *
   * @Public() because the whole point is that it is reachable WITHOUT a valid
   * access token: by the time a client needs this, its access token has expired.
   * The refresh cookie is the authentication here.
   *
   * Throttled because an unauthenticated endpoint that performs database writes
   * is a denial-of-service target. Brute-forcing a 256-bit token is not the
   * threat; flooding the endpoint is.
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 10, ttl: 1000 }, medium: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Rotate the refresh cookie and issue a new access token' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const presented = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    if (!presented) {
      this.clearRefreshCookie(res, this.isProduction);
      throw new UnauthorizedException('Session expired. Please sign in again.');
    }

    try {
      const result = await this.authService.refreshSession(presented, {
        userAgent: req.headers['user-agent'] ?? null,
        ipAddress: req.ip ?? req.socket.remoteAddress ?? null,
      });
      this.setRefreshCookie(res, result.refreshToken, this.isProduction);
      const { refreshToken: _rt, refreshExpiresAt: _re, ...body } = result;
      return body;
    } catch (err) {
      // Clear the cookie on any failure EXCEPT the benign concurrent-refresh
      // race. There, another tab has already replaced the cookie with a valid
      // successor, and clearing it would destroy a working session to resolve a
      // race that resolves itself.
      const isRetryable = err instanceof UnauthorizedException && err.message === 'Please retry.';
      if (!isRetryable) this.clearRefreshCookie(res, this.isProduction);
      throw err;
    }
  }

  /**
   * POST /api/v1/auth/logout — ends THIS session only.
   *
   * @Public() so logging out still works once the access token has expired,
   * which is exactly when a user is most likely to click it. Other devices are
   * untouched; /users/me/logout-all-devices remains the blunt instrument.
   */
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'End the current session' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const presented = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    const result = await this.authService.logout(presented);
    this.clearRefreshCookie(res, this.isProduction);
    return result;
  }
}
