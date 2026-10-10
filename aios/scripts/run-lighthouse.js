const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const targets = [
  { name: 'Login (Desktop)', url: 'http://localhost:3000/login', preset: 'desktop' },
  { name: 'Login (Mobile)', url: 'http://localhost:3000/login', preset: 'mobile' },
  { name: 'Teacher Dashboard (Desktop)', url: 'http://localhost:3000/dashboard/teacher', preset: 'desktop' },
  { name: 'Admin Dashboard (Desktop)', url: 'http://localhost:3000/dashboard/admin', preset: 'desktop' }
];

const results = [];

for (const t of targets) {
  console.log(`Running Lighthouse for: ${t.name}...`);
  const outFile = path.join(__dirname, `lh_${t.preset}_${t.name.split(' ')[0].toLowerCase()}.json`);
  const presetFlag = t.preset === 'desktop' ? '--preset=desktop' : '';
  const cmd = `npx lighthouse ${t.url} ${presetFlag} --chrome-flags="--headless=new --no-sandbox" --output=json --output-path="${outFile}" --quiet`;
  
  try {
    execSync(cmd, { stdio: 'inherit', timeout: 120000 });
    if (fs.existsSync(outFile)) {
      const report = JSON.parse(fs.readFileSync(outFile, 'utf8'));
      const scores = {
        name: t.name,
        preset: t.preset,
        performance: Math.round((report.categories.performance?.score || 0) * 100),
        accessibility: Math.round((report.categories.accessibility?.score || 0) * 100),
        bestPractices: Math.round((report.categories['best-practices']?.score || 0) * 100),
        seo: Math.round((report.categories.seo?.score || 0) * 100),
      };
      results.push(scores);
      console.log(`  Scores for ${t.name}:`, scores);
    }
  } catch (err) {
    console.error(`  Error running lighthouse for ${t.name}:`, err.message);
  }
}

console.log('\n====================================================');
console.log('FINAL LIGHTHOUSE SUMMARY TABLE');
console.log('====================================================');
console.table(results);

fs.writeFileSync(path.join(__dirname, 'lighthouse-summary.json'), JSON.stringify(results, null, 2));
