// ─── Audit Logs Module: Domain & View-Model Types ───────────────────────────

export interface AuditLogItem {
  id:        string;
  dateTime:  string;
  user:      string;
  avatar:    string;
  avatarBg:  string;
  action:    string;
  module:    string;
  details:   string;
  ipAddress: string;
}

export interface ActivityBreakdownItem {
  name:    string;
  value:   number;
  color:   string;
  percent: string;
}

export interface ModuleActivityItem {
  name:  string;
  count: number;
}

export interface ActiveOperatorItem {
  name:  string;
  role:  string;
  count: string;
  bg:    string;
}

export interface SecurityAlertItem {
  id:        string;
  title:     string;
  desc:      string;
  timestamp: string;
  severity:  'high' | 'medium' | 'info';
}

export interface AuditLogsAnalytics {
  totalActivities:      number; // 2486
  todaysActivities:     number; // 156
  activeOperators:      number; // 18
  failedAccess:         number; // 12
  activityBreakdown:    ActivityBreakdownItem[];
  moduleActivity:       ModuleActivityItem[];
  activeOperatorsList:  ActiveOperatorItem[];
  securityAlerts:       SecurityAlertItem[];
}

export interface GetAuditLogsParams {
  user?:   string;
  action?: string;
  module?: string;
  search?: string;
  page?:   number;
  limit?:  number;
}

export interface PaginatedAuditLogs {
  data:       AuditLogItem[];
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
}
