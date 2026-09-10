/**
 * Process-wide shutdown flag, set once when SIGTERM/SIGINT arrives.
 *
 * WHY A MODULE-LEVEL FLAG RATHER THAN A NEST PROVIDER: it is read by the
 * readiness probe and written by the signal handler in main.ts, which runs
 * outside the DI container and before/after the app context is usable. A
 * provider would not be reachable from the handler at the moment it matters —
 * during teardown, when the container is being disposed.
 *
 * The sequence this exists to make possible, on every rolling deploy:
 *
 *   1. SIGTERM arrives
 *   2. beginShutdown()             -> /health/ready starts returning 503
 *   3. the load balancer notices   -> stops routing NEW requests here
 *   4. app.close()                 -> in-flight requests finish, then exit
 *
 * Without step 2 the balancer keeps sending traffic to a process that is
 * already tearing down, and those requests fail. Draining first is what makes a
 * deploy invisible to users rather than a burst of 502s.
 *
 * One-way by design: there is no "cancel shutdown". A process that has begun
 * terminating must never advertise itself as ready again.
 */
let shuttingDown = false;

export function beginShutdown(): void {
  shuttingDown = true;
}

export function isShuttingDown(): boolean {
  return shuttingDown;
}

/** Test-only. Never call from application code — see the one-way note above. */
export function resetShutdownStateForTests(): void {
  shuttingDown = false;
}
