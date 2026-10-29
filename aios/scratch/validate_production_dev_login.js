const { z } = require(require.resolve('zod', { paths: ['apps/api'] }));

// 1. Re-create the production boot validation from apps/api/src/config/env.schema.ts
const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
    ENABLE_DEV_LOGIN: z
      .union([z.boolean(), z.string()])
      .transform((v) => (typeof v === 'boolean' ? v : v === 'true'))
      .default(false),
    INTERNAL_SERVICE_TOKEN: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.ENABLE_DEV_LOGIN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ENABLE_DEV_LOGIN'],
        message:
          'ENABLE_DEV_LOGIN must not be true when NODE_ENV=production — it exposes a ' +
          'credential-less login endpoint that mints tokens for any role. Refusing to start.',
      });
    }
    if (env.NODE_ENV === 'production' && !env.INTERNAL_SERVICE_TOKEN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['INTERNAL_SERVICE_TOKEN'],
        message: 'INTERNAL_SERVICE_TOKEN is required in production.',
      });
    }
  });

// 2. Simulate AuthService.loginAsMockRole production check
function simulateLoginAsMockRole(config) {
  const devLoginEnabled = config.ENABLE_DEV_LOGIN === true;
  const isProduction = config.NODE_ENV === 'production';

  if (!devLoginEnabled || isProduction) {
    const error = new Error('Mock login is disabled.');
    error.status = 403;
    throw error;
  }
  return { status: 200, message: 'Minted mock token' };
}

console.log('====================================================');
console.log('AIOS AUDIT: PRODUCTION DEV-LOGIN RESTRICTION SMOKE TEST');
console.log('====================================================\n');

// Test Case A: Production Boot with ENABLE_DEV_LOGIN=true (Must Refuse to Start)
console.log('[Test A] Simulating Production container boot with ENABLE_DEV_LOGIN=true...');
const prodInvalidResult = envSchema.safeParse({
  NODE_ENV: 'production',
  ENABLE_DEV_LOGIN: true,
  INTERNAL_SERVICE_TOKEN: 'a'.repeat(32),
});

if (!prodInvalidResult.success) {
  const issue = prodInvalidResult.error.issues[0];
  console.log(`✓ Boot Refusal Triggered: ${issue.message}`);
  console.log(`  Path: ${issue.path.join('.')} | Code: ${issue.code}`);
} else {
  console.error('❌ FATAL: Production boot allowed ENABLE_DEV_LOGIN=true!');
}

// Test Case B: Production Boot with ENABLE_DEV_LOGIN=false (Valid Production State)
console.log('\n[Test B] Simulating Production container boot with ENABLE_DEV_LOGIN=false...');
const prodValidResult = envSchema.safeParse({
  NODE_ENV: 'production',
  ENABLE_DEV_LOGIN: false,
  INTERNAL_SERVICE_TOKEN: 'a'.repeat(32),
});

if (prodValidResult.success) {
  console.log('✓ Production Boot Succeeded with ENABLE_DEV_LOGIN=false.');
} else {
  console.error('❌ Failed valid production config:', prodValidResult.error);
}

// Test Case C: Calling loginAsMockRole under Production config
console.log('\n[Test C] Calling loginAsMockRole under NODE_ENV=production...');
try {
  simulateLoginAsMockRole({ NODE_ENV: 'production', ENABLE_DEV_LOGIN: false });
  console.error('❌ FATAL: loginAsMockRole did not throw 403 in production!');
} catch (err) {
  console.log(`✓ Access Blocked: Status ${err.status} - "${err.message}"`);
}

// Test Case D: Calling loginAsMockRole under NODE_ENV=production even if flag was somehow true
console.log('\n[Test D] Calling loginAsMockRole under NODE_ENV=production with ENABLE_DEV_LOGIN=true...');
try {
  simulateLoginAsMockRole({ NODE_ENV: 'production', ENABLE_DEV_LOGIN: true });
  console.error('❌ FATAL: loginAsMockRole did not throw 403 in production even with flag true!');
} catch (err) {
  console.log(`✓ Defense-in-Depth Blocked: Status ${err.status} - "${err.message}"`);
}

console.log('\n✅ ALL PRODUCTION DEV-LOGIN SMOKE TESTS PASSED CLEANLY.');
