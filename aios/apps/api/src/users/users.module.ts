import { Module, forwardRef } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  // forwardRef because AuthModule already imports UsersModule. The cycle is real
  // and intentional: force-logout (here) must revoke refresh sessions (there),
  // while auth needs user lookups. Nest resolves it as long as both sides
  // declare it.
  imports: [forwardRef(() => AuthModule)],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
