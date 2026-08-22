/**
 * 12-LOGGING-MONITORING.md §2's exact structured JSON log format. Deliberately
 * writes straight to console rather than through Nest's default Logger, which
 * decorates lines with its own bracketed timestamp/context — that formatting
 * isn't machine-parseable JSON, which defeats the point of a log aggregator
 * schema. §3: never pass PII values here — ids only (userId, instituteId),
 * never guardian contact info, tokens, or full request/response bodies.
 */
export interface StructuredLogFields {
  service: string;
  requestId?: string;
  instituteId?: string;
  userId?: string;
  route?: string;
  errorCode?: string;
  durationMs?: number;
  message?: string;
}

export function logStructured(level: 'debug' | 'info' | 'warn' | 'error' | 'fatal', fields: StructuredLogFields): void {
  const line = JSON.stringify({ level, timestamp: new Date().toISOString(), ...fields });
  if (level === 'error' || level === 'fatal') {
    // eslint-disable-next-line no-console
    console.error(line);
  } else {
    // eslint-disable-next-line no-console
    console.log(line);
  }
}
