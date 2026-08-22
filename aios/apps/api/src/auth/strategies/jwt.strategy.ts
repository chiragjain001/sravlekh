import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { JwtPayload, AuthenticatedUser } from '../auth.types';

/**
 * JwtStrategy — validates the Bearer token on every protected route.
 * Extracts the JWT from the Authorization header, verifies signature,
 * then loads a fresh user record to confirm they are still active.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // env.schema.ts validates JWT_SECRET as a required min-32-char string
      // at bootstrap — the app would already have failed to start otherwise.
      secretOrKey: configService.get<string>('JWT_SECRET')!,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    return this.authService.validateJwtPayload(payload);
  }
}
