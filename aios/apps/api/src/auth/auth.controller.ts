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
import { Request } from 'express';
import { AuthService } from './auth.service';
import { GoogleLoginDto } from './dto/google-login.dto';
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
  @ApiOperation({ summary: 'Sign in with Google' })
  async loginWithGoogle(
    @Body() dto: GoogleLoginDto,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip ?? req.socket.remoteAddress;
    return this.authService.loginWithGoogle(dto.idToken, ipAddress);
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
