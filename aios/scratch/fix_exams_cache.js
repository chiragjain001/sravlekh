const fs = require('fs');
const filePath = 'apps/api/src/exams/exams.service.ts';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add cache check in findAll
const oldFindAllStart = '    const teacherBatchIds = await getTeacherBatchIds(this.prisma, actor, this.cache);';

const newFindAllStart = '    const teacherBatchIds = await getTeacherBatchIds(this.prisma, actor, this.cache);\r\n\r\n    const scope = teacherBatchIds ? teacherBatchIds.slice().sort().join(\',\') : (actor.role === UserRole.STUDENT ? actor.id : \'all\');\r\n    const cacheKey = "exams:list:" + instituteId + ":" + scope + ":" + page + ":" + limit + ":" + (query.status ?? \'all\') + ":" + (query.batchId ?? \'all\');\r\n    if (this.cache) {\r\n      const cached = await this.cache.get<any>(cacheKey);\r\n      if (cached) return cached;\r\n    }';

content = content.replace(oldFindAllStart, newFindAllStart);

// 2. Add cache set in findAll return
const oldFindAllReturn = '    return {\r\n      data,\r\n      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },\r\n    };\r\n  }';

const newFindAllReturn = '    const result = {\r\n      data,\r\n      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },\r\n    };\r\n    if (this.cache) {\r\n      await this.cache.set(cacheKey, result, 30);\r\n    }\r\n    return result;\r\n  }';

content = content.replace(oldFindAllReturn, newFindAllReturn);

// 3. Add cache invalidation in writeAudit
const oldWriteAudit = '  private async writeAudit(instituteId: string, actorId: string, action: AuditAction, entity: string, entityId: string, oldValue: unknown, newValue: unknown) {\r\n    try {\r\n      await this.prisma.auditLog.create({\r\n        data: { instituteId, actorId, action, entity, entityId, oldValue: oldValue as any, newValue: newValue as any },\r\n      });';

const newWriteAudit = '  private async writeAudit(instituteId: string, actorId: string, action: AuditAction, entity: string, entityId: string, oldValue: unknown, newValue: unknown) {\r\n    try {\r\n      await this.prisma.auditLog.create({\r\n        data: { instituteId, actorId, action, entity, entityId, oldValue: oldValue as any, newValue: newValue as any },\r\n      });\r\n      if (this.cache && (entity === \'exams\' || entity === \'papers\')) {\r\n        await this.cache.delByPrefix("exams:list:" + instituteId + ":");\r\n      }';

content = content.replace(oldWriteAudit, newWriteAudit);

fs.writeFileSync(filePath, content, 'utf8');
console.log('ExamsService caching added successfully!');

