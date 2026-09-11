import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  // For RefreshTokenService: force-logout and logout-all-devices must revoke
  // refresh sessions too, or the next refresh re-issues a valid access token and
  // quietly undoes the logout. AuthModule does not import UsersModule, so this is
  // a plain one-way import — no forwardRef needed.
  imports: [AuthModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
