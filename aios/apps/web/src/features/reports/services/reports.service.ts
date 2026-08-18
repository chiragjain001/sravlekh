// ─── Reports Service Layer ────────────────────────────────────────────────────

import type {
  ReportItem,
  ReportsAnalytics,
  GetReportsParams,
  GenerateReportInput,
} from '../types/reports.types';

import {
  MOCK_REPORTS_CATALOG,
  MOCK_REPORTS_ANALYTICS,
} from '../mock/reports.mock';

const delay = (ms = 400) => new Promise<void>((r) => setTimeout(r, ms));

let _reportsStore: ReportItem[] = JSON.parse(JSON.stringify(MOCK_REPORTS_CATALOG));
let _analyticsStore: ReportsAnalytics = JSON.parse(JSON.stringify(MOCK_REPORTS_ANALYTICS));

// ─────────────────────────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────────────────────────

export async function getReportsCatalog(params: GetReportsParams = {}): Promise<ReportItem[]> {
  await delay(350);

  const { category, program, batch, search } = params;
  let items = [..._reportsStore];

  if (category && category !== 'All Reports') {
    items = items.filter((r) => r.category.toLowerCase().includes(category.toLowerCase()));
  }
  if (program && program !== 'All Programs') {
    items = items.filter((r) => !r.program || r.program.toLowerCase().includes(program.toLowerCase()));
  }
  if (batch && batch !== 'All Batches') {
    items = items.filter((r) => !r.batch || r.batch.toLowerCase().includes(batch.toLowerCase()));
  }
  if (search) {
    const q = search.toLowerCase();
    items = items.filter(
      (r) => r.title.toLowerCase().includes(q) || r.category.toLowerCase().includes(q)
    );
  }

  return items;
}

export async function getReportsAnalytics(): Promise<ReportsAnalytics> {
  await delay(400);
  return { ..._analyticsStore };
}

// ─────────────────────────────────────────────────────────────────────────────
// WRITE
// ─────────────────────────────────────────────────────────────────────────────

export async function generateReport(input: GenerateReportInput): Promise<ReportItem> {
  await delay(600);

  const newReport: ReportItem = {
    id:             `rep-${Date.now()}`,
    title:          input.title,
    category:       input.category,
    generatedDate:  'Today',
    downloadsCount: 1,
    downloadsText:  'Downloaded 1 time',
    fileSize:       '2.5 MB',
    format:         input.format,
    program:        input.program,
    batch:          input.batch,
  };

  _reportsStore.unshift(newReport);
  return newReport;
}

export async function downloadReport(id: string): Promise<void> {
  await delay(400);
  const rep = _reportsStore.find((r) => r.id === id);
  if (rep) {
    rep.downloadsCount += 1;
    rep.downloadsText  = `Downloaded ${rep.downloadsCount} times`;
  }
}
