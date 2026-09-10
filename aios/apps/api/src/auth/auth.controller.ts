import {
  Controller,
  Post,
  Body,
  Get,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { GoogleLoginDto } from './dto/google-login.dto';
import { DevLoginDto } from './dto/dev-login.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthenticatedUser } from './auth.types';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
  ) {
    const ipAddress = req.ip ?? req.socket.remoteAddress;
    return this.authService.loginWithGoogle(dto.idToken, ipAddress);
  }

  /**
   * 06-AUTH-AUTHORIZATION.md §1: dev/test-only mock login, disabled in production
   * (enforced in AuthService, not just here — see loginAsMockRole).
   */
  @Public()
  @Post('dev-login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'DEV ONLY: sign in as a seeded mock user by role' })
  async devLogin(@Body() dto: DevLoginDto) {
    return this.authService.loginAsMockRole(dto.role);
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
}
