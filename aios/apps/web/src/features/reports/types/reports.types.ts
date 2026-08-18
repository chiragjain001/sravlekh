// ─── Reports Module: Domain & View-Model Types ─────────────────────────────

export type ReportCategory =
  | 'Academic Reports'
  | 'Student Reports'
  | 'Financial Reports'
  | 'Faculty Reports'
  | 'Operational Reports';

export interface ReportItem {
  id:             string;
  title:          string;
  category:       ReportCategory | string;
  generatedDate:  string;
  downloadsCount: number; // e.g. 124
  downloadsText:  string; // e.g. "Downloaded 124 times"
  fileSize:       string; // e.g. "2.4 MB"
  format:         'PDF' | 'CSV' | 'XLSX';
  program?:       string; // 'JEE' | 'NEET' | 'Foundation'
  batch?:         string; // 'JEE 2025 Star' | 'NEET 2025 Target' | 'Foundation 11A'
}

export interface PerformanceTrendItem {
  date:           string;
  Attendance:     number;
  Performance:    number;
  PassPercentage: number;
}

export interface AttendanceSummaryItem {
  name:    string;
  value:   number;
  color:   string;
  percent: string;
}

export interface TopBatchItem {
  id:       string;
  name:     string;
  score:    number; // e.g. 91 (%)
  color:    string;
  students: number;
  topper:   string;
}

export interface BatchDueRow {
  batch:    string;
  pending:  string;
  students: number;
}

export interface FinancialSummary {
  totalCollected: string; // "₹24,80,000"
  totalExpected:  string; // "₹28,50,000"
  pendingAmount:  string; // "₹3,70,000"
  collectionRate: number; // 87 (%)
  batchDuesList:  BatchDueRow[];
}

export interface ReportsAnalytics {
  avgAttendance:      number; // 92
  avgPerformance:     number; // 78
  passPercentage:     number; // 88
  feeCollectionRate:  number; // 87

  performanceTrend:  PerformanceTrendItem[];
  attendanceSummary: AttendanceSummaryItem[];
  topBatches:        TopBatchItem[];
  financialSummary:  FinancialSummary;
}

export interface GetReportsParams {
  category?: string;
  program?:  string;
  batch?:    string;
  search?:   string;
}

export interface GenerateReportInput {
  title:      string;
  category:   ReportCategory;
  dateRange:  string;
  program?:   string;
  batch?:     string;
  format:     'PDF' | 'CSV' | 'XLSX';
}
