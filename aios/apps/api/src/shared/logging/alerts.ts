import { Logger } from '@nestjs/common';
import * as Sentry from '@sentry/node';

/**
 * Named production alert conditions (12-LOGGING-MONITORING.md §7).
 *
 * WHY A MODULE RATHER THAN ad-hoc Sentry CALLS: Sentry already receives every
 * thrown exception (AllExceptionsFilter) and every dead-lettered job
 * (reportDeadLetter). What it did NOT receive was anything that is not an
 * exception — a queue quietly growing, a provider degrading, or a credential
 * being replayed. Those are the conditions worth waking someone for, and none of
 * them throws.
 *
 * Every alert here carries a STABLE `alert` tag, so a vendor-side rule can be
 * written against the name rather than against message text that will be
 * reworded later. The severity is set here too, because "is this worth paging
 * for" is a property of the condition, not of the dashboard someone happens to
 * be looking at.
 *
 * ON NOISE. An alert that fires routinely trains people to ignore it, which is
 * worse than having no alert. So:
 *   - transient, self-healing conditions (one retryable job failure, one slow
 *     request) are deliberately NOT alerts — they are metrics;
 *   - only exhausted retries, sustained backlog, and confirmed security events
 *     raise anything;
 *   - each condition documents the threshold it expects, so the vendor rule and
 *     the code cannot drift apart silently.
 */

export type AlertName =
  /** A refresh token was replayed after rotation. Confirmed credential compromise. */
  | 'security.refresh_token_reuse'
  /** A queue's waiting depth has passed its threshold. Workers are not keeping up. */
  | 'queue.backlog'
  /** A queue has failed jobs sitting in its dead-letter set. */
  | 'queue.dead_letter_present'
  /** A dependency the API cannot serve without is unreachable. */
  | 'dependency.unavailable';

export type AlertSeverity = 'warning' | 'error' | 'fatal';

type AlertContext = Record<string, string | number | boolean | null | undefined>;

/**
 * Raises a named alert.
 *
 * Sentry is optional everywhere in this codebase (SENTRY_DSN unset is a silent
 * no-op), so the log line is written unconditionally and first. An environment
 * without Sentry still gets the signal in its logs, where a log-based alert can
 * find it — the alerting story must not depend entirely on one vendor being
 * configured.
 */
export function raiseAlert(
  name: AlertName,
  severity: AlertSeverity,
  message: string,
  context: AlertContext = {},
  logger?: Logger,
): void {
  const serialisedContext = JSON.stringify(context);
  const line = `[ALERT ${name}] ${message} ${serialisedContext}`;

  const log = logger ?? new Logger('Alerts');
  if (severity === 'warning') log.warn(line);
  else log.error(line);

  Sentry.captureMessage(message, {
    level: severity,
    tags: {
      // The stable handle a vendor rule matches on. Message text is for humans
      // and will be reworded; this is not.
      alert: name,
      severity,
    },
    extra: context,
  });
}

/**
 * A refresh token was presented after it had already been rotated.
 *
 * This is not a suspicion — under rotation, a correctly behaving client never
 * sends the same refresh token twice, and the concurrent-refresh grace window
 * has already excluded the benign race. Two copies of the credential exist.
 *
 * SEVERITY: error, not warning. It is the only signal in the system that names a
 * specific compromised account, and the session family has already been revoked
 * by the time this fires — so the alert is the ONLY way anyone learns it
 * happened. It was previously a bare logger.warn, which meant a confirmed
 * credential theft produced nothing an on-call rotation would ever see.
 *
 * THRESHOLD: alert on the first occurrence per user. One is meaningful; a burst
 * across many users at once means something systemic (a leaked backup, a
 * compromised device fleet) and should escalate.
 *
 * No token, hash, IP or user agent is included. This describes an event; the
 * forensic detail lives in the refresh_tokens row, behind normal access control.
 */
export function alertRefreshTokenReuse(
  userId: string,
  familyId: string,
  secondsSinceRotation: number,
  logger?: Logger,
): void {
  raiseAlert(
    'security.refresh_token_reuse',
    'error',
    'Refresh token reuse detected — session family revoked',
    { userId, familyId, secondsSinceRotation },
    logger,
  );
}

/**
 * A queue's waiting depth has passed its threshold.
 *
 * SEVERITY: warning. A backlog is a capacity problem, not an outage — work is
 * still being accepted and will still be done, just late. It becomes an outage
 * only if it keeps growing, which is a trend the vendor rule should evaluate
 * (sustained over N minutes) rather than something this single sample can know.
 *
 * Deliberately NOT alerted on every sample above the line: a marking-day spike
 * is normal and self-clearing. See QUEUE_BACKLOG_THRESHOLDS for the numbers and
 * why each one differs.
 */
export function alertQueueBacklog(
  queue: string,
  waiting: number,
  threshold: number,
  logger?: Logger,
): void {
  raiseAlert(
    'queue.backlog',
    'warning',
    `Queue "${queue}" backlog is above threshold`,
    { queue, waiting, threshold },
    logger,
  );
}

/** Jobs have exhausted their retries and are sitting failed. */
export function alertDeadLetterPresent(queue: string, failed: number, logger?: Logger): void {
  raiseAlert(
    'queue.dead_letter_present',
    'error',
    `Queue "${queue}" has dead-lettered jobs`,
    { queue, failed },
    logger,
  );
}

/**
 * A dependency the API cannot serve without is unreachable.
 *
 * SEVERITY: fatal for the database (nothing works), error for anything the app
 * degrades around. Redis is deliberately NOT fatal — caching fails open and
 * enqueue paths fail fast, so the API keeps serving almost every request.
 */
export function alertDependencyUnavailable(
  dependency: string,
  detail: string,
  severity: AlertSeverity = 'error',
  logger?: Logger,
): void {
  raiseAlert(
    'dependency.unavailable',
    severity,
    `Dependency "${dependency}" is unavailable`,
    { dependency, detail },
    logger,
  );
}

/**
 * Per-queue backlog thresholds.
 *
 * These are NOT one number applied uniformly, because the queues do very
 * different work and a depth that is alarming for one is a normal Tuesday for
 * another. Each is set relative to what that queue's own concurrency
 * (queue-policy.ts) can clear in a few minutes.
 */
export const QUEUE_BACKLOG_THRESHOLDS: Record<string, number> = {
  // Concurrency 4, seconds per job. A few hundred waiting is an exam finishing;
  // a thousand means workers are not keeping up.
  'ai-evaluation': 1000,
  // Concurrency 3, and each job is a slow vision call. Backs up faster.
  ocr: 500,
  // Cheap and fast; a backlog here means something is genuinely wrong.
  'score-aggregation': 200,
  'mastery-recalc': 200,
  // Fan-out per notice; a large announcement legitimately produces a spike.
  'notice-dispatch': 2000,
  // Rare, heavy, user-initiated. More than a handful waiting is unusual.
  'report-generation': 50,
};
