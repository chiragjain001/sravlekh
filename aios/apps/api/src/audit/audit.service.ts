import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, type AuditLog } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { QueryAuditLogsDto } from './dto/audit-log.dto';

// 07-SECURITY-SPECIFICATION.md: oldValue/newValue must redact PII field values
// while still recording that a change occurred. Applied at read time for this
// phase's new endpoints — a write-time redaction pass across every existing
// writeAudit() call site is a separate, broader hardening change (see docs/33).
const PII_KEY_PATTERN = /email|phone|address|dateofbirth|googlesub|ssn|password|token|secret/i;

function redactPii(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactPii);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        PII_KEY_PATTERN.test(k) ? '[REDACTED]' : redactPii(v),
      ]),
    );
  }
  return value;
}

function redactAuditLog(log: AuditLog) {
  return { ...log, oldValue: redactPii(log.oldValue), newValue: redactPii(log.newValue) };
}

/**
 * Longest window a client may ask about in one poll. Bounds the index scan and
 * stops a stale/hostile `since` from turning the feed into a full table read.
 * A client that has been away longer simply refetches everything instead.
 */
const MAX_CHANGE_LOOKBACK_MS = 10 * 60 * 1000;

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Change feed backing the dashboards' live updates.
   *
   * Every mutating service already writes an audit row, so "what changed in this
   * institute since T" is one indexed read (@@index([instituteId, createdAt])).
   * Clients poll this cheaply and invalidate only the affected caches, instead of
   * every screen re-polling its own (much heavier) list endpoint on a timer.
   *
   * Deliberately returns entity NAMES only — no ids, no old/new values — so it
   * leaks nothing a caller would not be allowed to read, and needs no per-role
   * filtering. It is readable by any authenticated member of the institute.
   */
  async getChangedEntities(instituteId: string, actor: AuthenticatedUser, since?: string) {
    if (actor.role !== UserRole.FOUNDER && actor.instituteId !== instituteId) {
      throw new ForbiddenException("You don't have access to this institute.");
    }

    const now = new Date();
    const floor = new Date(now.getTime() - MAX_CHANGE_LOOKBACK_MS);
    const requested = since ? new Date(since) : null;
    const from = requested && !Number.isNaN(requested.getTime()) && requested > floor ? requested : floor;

    const rows = await this.prisma.auditLog.findMany({
      where: { instituteId, createdAt: { gt: from } },
      select: { entity: true },
      distinct: ['entity'],
      take: 50,
    });

    // `now` is echoed back as the client's next cursor so the window can never
    // skip a row written between the query and the client's clock.
    return { now: now.toISOString(), entities: rows.map((r) => r.entity) };
  }

  // ── ADMIN: own tenant only. FOUNDER: any tenant via the same route. ───────
  async findAll(instituteId: string, query: QueryAuditLogsDto, actor: AuthenticatedUser) {
    if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.FOUNDER) {
      throw new ForbiddenException('Only admins can view audit logs.');
    }
    if (actor.role === UserRole.ADMIN && actor.instituteId !== instituteId) {
      throw new ForbiddenException("You don't have access to this institute's audit logs.");
    }

    return this.queryLogs({ instituteId, ...this.buildFilters(query) }, query);
  }

  // ── FOUNDER only: global, optionally filtered to one institute. ───────────
  async findAllGlobal(query: QueryAuditLogsDto & { instituteId?: string }, actor: AuthenticatedUser) {
    if (actor.role !== UserRole.FOUNDER) {
      throw new ForbiddenException('Only the founder can view cross-tenant audit logs.');
    }

    return this.queryLogs(
      { ...(query.instituteId ? { instituteId: query.instituteId } : {}), ...this.buildFilters(query) },
      query,
    );
  }

  private buildFilters(query: QueryAuditLogsDto): Record<string, unknown> {
    const where: Record<string, unknown> = {};
    if (query.actorUserId) where.actorId = query.actorUserId;
    if (query.action) where.action = query.action;
    if (query.entity) where.entity = query.entity;
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
      };
    }
    return where;
  }

  private async queryLogs(where: Record<string, unknown>, query: QueryAuditLogsDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { name: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs.map(redactAuditLog),
      meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    };
  }
}
