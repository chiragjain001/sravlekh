import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * @Public() — marks a route as publicly accessible (no JWT required).
 *
 * Usage:
 *   @Public()
 *   @Post('auth/google')
 *   loginWithGoogle() { ... }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
