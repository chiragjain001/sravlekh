const fs = require('fs');
const filePath = 'apps/api/src/attendance/attendance.service.ts';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add Optional and CacheService
content = content.replace(
  '  Logger,\r\n} from \'@nestjs/common\';',
  '  Logger,\r\n  Optional,\r\n} from \'@nestjs/common\';\r\nimport { CacheService } from \'../infrastructure/cache/cache.service\';'
);

content = content.replace(
  '  constructor(\r\n    private readonly prisma: PrismaService,\r\n    private readonly permissionsService: PermissionsService,\r\n  ) {}',
  '  constructor(\r\n    private readonly prisma: PrismaService,\r\n    private readonly permissionsService: PermissionsService,\r\n    @Optional() private readonly cache?: CacheService,\r\n  ) {}'
);

// 2. Add cache check in getSummary
const oldSummaryHead = '  async getSummary(instituteId: string, query: QueryAttendanceSummaryDto, actor: AuthenticatedUser) {\r\n    this.assertInstituteAccess(actor, instituteId);\r\n\r\n    const teacherBatchIds = await getTeacherBatchIds(this.prisma, actor);';

const newSummaryHead = '  async getSummary(instituteId: string, query: QueryAttendanceSummaryDto, actor: AuthenticatedUser) {\r\n    this.assertInstituteAccess(actor, instituteId);\r\n\r\n    const teacherBatchIds = await getTeacherBatchIds(this.prisma, actor, this.cache);\r\n    const scope = teacherBatchIds ? teacherBatchIds.slice().sort().join(\',\') : \'all\';\r\n    const cacheKey = "attendance-summary:" + instituteId + ":" + scope + ":" + (query.batchId ?? "") + ":" + (query.dateFrom ?? "") + ":" + (query.dateTo ?? "");\r\n    if (this.cache) {\r\n      const cached = await this.cache.get<any>(cacheKey);\r\n      if (cached) return cached;\r\n    }';

content = content.replace(oldSummaryHead, newSummaryHead);

// 3. Add cache set in getSummary
const oldSummaryTail = '    return {\r\n      overallAttendancePct: overallMetrics.overallAttendancePct ?? 0,\r\n      statusBreakdown: overallMetrics.statusBreakdown,\r\n      byBatch,\r\n      byStudent,\r\n    };\r\n  }';

const newSummaryTail = '    const result = {\r\n      overallAttendancePct: overallMetrics.overallAttendancePct ?? 0,\r\n      statusBreakdown: overallMetrics.statusBreakdown,\r\n      byBatch,\r\n      byStudent,\r\n    };\r\n    if (this.cache) {\r\n      await this.cache.set(cacheKey, result, 60);\r\n    }\r\n    return result;\r\n  }';

content = content.replace(oldSummaryTail, newSummaryTail);

// 4. Invalidate cache on mutations
content = content.replace(
  '    return { success: true, count: savedRecords.length, state: updatedSession.state };\r\n  }\r\n\r\n  // ── 3. Finalize Session',
  '    if (this.cache) {\r\n      await this.cache.delByPrefix("attendance-summary:" + instituteId + ":");\r\n    }\r\n    return { success: true, count: savedRecords.length, state: updatedSession.state };\r\n  }\r\n\r\n  // ── 3. Finalize Session'
);

content = content.replace(
  '    return { success: true, state: finalized.state, finalizedAt: finalized.finalizedAt };\r\n  }\r\n\r\n  // ── 4. Retroactive Correction',
  '    if (this.cache) {\r\n      await this.cache.delByPrefix("attendance-summary:" + instituteId + ":");\r\n    }\r\n    return { success: true, state: finalized.state, finalizedAt: finalized.finalizedAt };\r\n  }\r\n\r\n  // ── 4. Retroactive Correction'
);

content = content.replace(
  '    return { success: true, record: updatedRecord };\r\n  }\r\n\r\n  // ── 5. Timetable Exception Overrides',
  '    if (this.cache) {\r\n      await this.cache.delByPrefix("attendance-summary:" + instituteId + ":");\r\n    }\r\n    return { success: true, record: updatedRecord };\r\n  }\r\n\r\n  // ── 5. Timetable Exception Overrides'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('AttendanceService caching added successfully!');

