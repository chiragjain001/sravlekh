// ─── Audit Logs Service Layer ─────────────────────────────────────────────────

import type {
  AuditLogItem,
  AuditLogsAnalytics,
  GetAuditLogsParams,
  PaginatedAuditLogs,
} from '../types/audit-log.types';

import {
  MOCK_AUDIT_LOGS,
  MOCK_AUDIT_ANALYTICS,
} from '../mock/audit-log.mock';

const delay = (ms = 400) => new Promise<void>((r) => setTimeout(r, ms));

let _logsStore: AuditLogItem[] = JSON.parse(JSON.stringify(MOCK_AUDIT_LOGS));
let _analyticsStore: AuditLogsAnalytics = JSON.parse(JSON.stringify(MOCK_AUDIT_ANALYTICS));

// ─────────────────────────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────────────────────────

export async function getAuditLogs(params: GetAuditLogsParams = {}): Promise<PaginatedAuditLogs> {
  await delay(350);

  const { user, action, module: mod, search, page = 1, limit = 10 } = params;
  let items = [..._logsStore];

  if (user) {
    items = items.filter((l) => l.user.toLowerCase().includes(user.toLowerCase()));
  }
  if (action) {
    items = items.filter((l) => l.action.toLowerCase().includes(action.toLowerCase()));
  }
  if (mod) {
    items = items.filter((l) => l.module.toLowerCase() === mod.toLowerCase());
  }
  if (search) {
    const q = search.toLowerCase();
    items = items.filter(
      (l) => l.user.toLowerCase().includes(q) ||
             l.action.toLowerCase().includes(q) ||
             l.module.toLowerCase().includes(q) ||
             l.details.toLowerCase().includes(q)
    );
  }

  const total = items.length;
  const start = (page - 1) * limit;
  const paginatedData = items.slice(start, start + limit);

  return {
    data:       paginatedData,
    total:      2486, // total system counter
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

export async function getAuditLogAnalytics(): Promise<AuditLogsAnalytics> {
  await delay(400);
  return { ..._analyticsStore };
}

export async function exportAuditLogs(): Promise<void> {
  await delay(500);
}
