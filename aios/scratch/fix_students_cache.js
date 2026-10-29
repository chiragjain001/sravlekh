const fs = require('fs');
let c = fs.readFileSync('apps/api/src/students/students.service.ts', 'utf8');

c = c.replace(
  'const cacheKey = students-stats::;',
  'const cacheKey = "students-stats:" + instituteId + ":" + scope;'
);

c = c.replaceAll(
  'delByPrefix(`students-stats:${instituteId}:`)',
  'delByPrefix("students-stats:" + instituteId + ":")'
);

c = c.replaceAll(
  'delByPrefix(students-stats::)',
  'delByPrefix("students-stats:" + instituteId + ":")'
);

fs.writeFileSync('apps/api/src/students/students.service.ts', c, 'utf8');
console.log('Fixed cacheKey and delByPrefix in students.service.ts');

