const fs = require('fs');
const path = require('path');

const roles = ['admin', 'teacher', 'student', 'founder'];
const results = {};

for (const role of roles) {
  const filePath = path.join(__dirname, '..', 'apps', 'web', 'src', 'app', 'dashboard', role, 'page.tsx');
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const regex = /case\s+'([^']+)':/g;
    const tabs = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
      tabs.push(match[1]);
    }
    results[role] = tabs;
  }
}

console.log('DISCOVERABLE DASHBOARD TABS:');
for (const [r, tabs] of Object.entries(results)) {
  console.log(`\n=== ${r.toUpperCase()} (${tabs.length} tabs) ===`);
  tabs.forEach(t => console.log(`  - ${t}`));
}

fs.writeFileSync(path.join(__dirname, 'routes-inventory.json'), JSON.stringify(results, null, 2));
