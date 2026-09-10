import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { MaintenanceGuard } from './guards/maintenance.guard';
import { UserThrottlerGuard } from '../shared/guards/user-throttler.guard';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          // @nestjs/jwt 11's expiresIn now types against `ms`'s branded
          // StringValue template-literal union rather than a plain string —
          // a config-sourced value can't be narrowed to that at compile
          // time, so this is a type-only cast; the runtime value (a
          // ms-parseable duration string like "7d") is unchanged.
          expiresIn: config.get<string>('JWT_EXPIRES_IN', '7d') as unknown as number,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    // Applied globally, in order: JwtAuthGuard authenticates (unless @Public()),
    // then RolesGuard authorizes (unless the route has no @Roles()), then
    // MaintenanceGuard blocks everyone but FOUNDER when maintenance mode is on
    // (needs req.user, so must run after the two above), then
    // UserThrottlerGuard rate-limits — deliberately last, so req.user is already
    // populated and it can key by authenticated user rather than shared IP.
    // See 06-AUTH-AUTHORIZATION.md — every route must be authenticated by default.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: MaintenanceGuard },
    { provide: APP_GUARD, useClass: UserThrottlerGuard },
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
