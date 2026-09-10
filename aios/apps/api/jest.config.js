/** @type {import('jest').Config} */
module.exports = {
  rootDir: 'src',
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json' }],
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',

  // Memory ceiling per worker. ts-jest compiles every spec in-process and Nest's
  // Test.createTestingModule builds a fresh DI container per suite, so a worker's
  // heap grows across the suites it runs. Recycling a worker once it passes this
  // limit bounds that growth without capping parallelism.
  //
  // This alone does NOT make the suite immune to a memory-starved host: Jest
  // still runs (cores - 1) workers, so peak usage is roughly that many times this
  // limit. On a machine with ~1 GB free, a full run is still killed with
  // "FATAL ERROR: ... process out of memory", which Jest reports confusingly as a
  // suite "failing" with zero failing tests — the suites pass fine in isolation
  // and nothing is wrong with the code. Use `pnpm test:ci` (or
  // `jest --maxWorkers=2`) on constrained machines and CI runners; GitHub's
  // standard runner is 2 cores / 7 GB, where bounded concurrency matters more
  // than maximum parallelism.
  workerIdleMemoryLimit: '512MB',
};
