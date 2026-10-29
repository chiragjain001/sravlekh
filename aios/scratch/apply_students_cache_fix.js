const fs = require('fs');
const file = 'apps/api/src/students/students.service.ts';
let content = fs.readFileSync(file, 'utf8');

const target = '        },\r\n      });\r\n    } catch (err) {';
const replacement = '        },\r\n      });\r\n      if (this.cache) {\r\n        await this.cache.delByPrefix("students-stats:" + instituteId + ":");\r\n      }\r\n    } catch (err) {';

if (!content.includes(target)) {
  console.error('Target not found in students.service.ts');
  process.exit(1);
}

content = content.replace(target, replacement);
fs.writeFileSync(file, content, 'utf8');
console.log('Successfully added cache invalidation to students.service.ts');
