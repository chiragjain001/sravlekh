/**
 * Repairs an exception that carries no message, WITHOUT replacing the exception.
 *
 * THE DEFECT THIS FIXES, found by running a real worker against real Redis:
 * a dead-lettered mastery-recalc job had `failedReason: ""`. BullMQ was behaving
 * correctly — it stores `err.message` verbatim — and the error genuinely had no
 * message.
 *
 * The cause is Node, not us: `localhost` resolves to BOTH `::1` and `127.0.0.1`,
 * so a refused connection produces an `AggregateError` wrapping two inner errors,
 * and `AggregateError.message` is `""` by design. The real detail lives in
 * `.errors[]` (often one `cause` deeper, since axios re-wraps it). Every
 * dual-stack connection failure looks like this, which is the most common way a
 * service outage actually presents — so the queue's most useful diagnostic field
 * was blank in exactly the situation it exists for. `reportDeadLetter`'s retry
 * line had the same hole, printing "will retry: " with nothing after it.
 *
 * The message is REBUILT FROM THE ERROR'S OWN DATA — inner messages, `code`, the
 * request URL — never a generic placeholder, and never a substitute for the real
 * exception. The original object is returned unchanged in type, stack, `code`
 * and identity; only a blank `message` is filled in. An error that already says
 * something useful is left strictly alone.
 */

interface ErrorLike {
  message?: string;
  name?: string;
  code?: string;
  errors?: unknown;
  cause?: unknown;
  config?: { url?: string; method?: string };
}

const MAX_INNER = 4;

/** Pulls the real text out of an AggregateError, following one `cause` hop. */
function innerMessages(err: ErrorLike): string[] {
  // Take whichever level actually HAS entries. Checking `err.errors` first and
  // stopping there was wrong: axios can leave an EMPTY errors array on the outer
  // error while the real two entries sit on `cause`, so the empty array won the
  // test and produced a message with no detail in it.
  const candidates: unknown[][] = [];
  if (Array.isArray(err.errors)) candidates.push(err.errors);
  const causeErrors = (err.cause as ErrorLike | undefined)?.errors;
  if (Array.isArray(causeErrors)) candidates.push(causeErrors);
  const source = candidates.find((c) => c.length > 0) ?? [];

  return source
    .slice(0, MAX_INNER)
    .map((e) => (e as ErrorLike)?.message)
    .filter((m): m is string => typeof m === 'string' && m.trim().length > 0);
}

/** A description assembled only from what the error itself reports. */
export function describeError(err: unknown): string {
  const e = (err ?? {}) as ErrorLike;

  if (typeof e.message === 'string' && e.message.trim().length > 0) {
    return e.message;
  }

  const parts: string[] = [];
  const label = e.name && e.name !== 'Error' ? e.name : undefined;
  if (label) parts.push(e.code ? `${label} [${e.code}]` : label);
  else if (e.code) parts.push(e.code);

  const inner = innerMessages(e);
  if (inner.length > 0) parts.push(inner.join('; '));

  // axios attaches the target; without it "ECONNREFUSED" alone does not say
  // WHICH dependency was unreachable, which is the first thing anyone asks.
  const target = e.config?.url
    ? `${(e.config.method ?? 'request').toUpperCase()} ${e.config.url}`
    : undefined;
  if (target) parts.push(`(${target})`);

  return parts.length > 0 ? parts.join(': ').replace(': (', ' (') : 'Unknown error (no message on the thrown value)';
}

/**
 * Fills in a blank `message` in place and returns the SAME error.
 *
 * Mutating rather than wrapping is deliberate: wrapping would change the error's
 * type and break any `instanceof` / `err.code` check downstream, and the brief
 * here is to make the existing exception legible, not to substitute a new one.
 * `message` is a writable own property on Error instances; a frozen error is
 * left untouched rather than throwing from inside a failure path.
 */
export function ensureDiagnosableMessage<E>(err: E): E {
  const e = err as ErrorLike;
  if (!e || typeof e !== 'object') return err;
  if (typeof e.message === 'string' && e.message.trim().length > 0) return err;

  try {
    e.message = describeError(err);
  } catch {
    // Frozen or getter-only message — nothing to do. describeError still gives
    // callers a usable string, and the original error propagates untouched.
  }
  return err;
}
