const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const routesInventory = JSON.parse(fs.readFileSync(path.join(__dirname, 'routes-inventory.json'), 'utf8'));

async function deepCrawl() {
  console.log('Starting Complete Production Deep-Crawl Test Suite...');
  const browser = await puppeteer.launch({
    channel: 'chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const crawlReport = {
    totalDiscoverable: 57,
    tested: 0,
    untested: 0,
    passed: 0,
    failed: 0,
    details: [],
    consoleErrors: []
  };

  page.on('console', msg => {
    if (msg.type() === 'error' && !msg.text().includes('GSI_LOGGER')) {
      crawlReport.consoleErrors.push({ url: page.url(), error: msg.text() });
    }
  });

  page.on('pageerror', err => {
    crawlReport.consoleErrors.push({ url: page.url(), error: err.message });
  });

  try {
    // 1. Login Page
    console.log('\n--- Checking Public Routes ---');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
    crawlReport.details.push({ route: '/login', role: 'PUBLIC', status: 'PASS' });
    crawlReport.tested++;
    crawlReport.passed++;

    // Role-based testing
    const roleMap = [
      { name: 'ADMIN', button: 'Demo as Admin', base: 'http://localhost:3000/dashboard/admin?nav=', tabs: routesInventory.admin },
      { name: 'TEACHER', button: 'Demo as Teacher', base: 'http://localhost:3000/dashboard/teacher?tab=', tabs: routesInventory.teacher },
      { name: 'STUDENT', button: 'Demo as Student', base: 'http://localhost:3000/dashboard/student?nav=', tabs: routesInventory.student },
      { name: 'FOUNDER', button: 'Demo as Founder', base: 'http://localhost:3000/dashboard/founder?nav=', tabs: routesInventory.founder }
    ];

    for (const r of roleMap) {
      console.log(`\n=== Testing Role: ${r.name} (${r.tabs.length} tabs) ===`);
      await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
      await page.evaluate(() => localStorage.clear());
      await page.reload({ waitUntil: 'networkidle2' });

      const btn = await page.waitForSelector(`button::-p-text("${r.button}")`, { timeout: 10000 });
      await btn.click();
      await page.waitForFunction((expected) => window.location.pathname.toLowerCase().includes(expected.toLowerCase()), { timeout: 15000 }, r.name);
      await new Promise(res => setTimeout(res, 1000));

      for (const tab of r.tabs) {
        const targetUrl = `${r.base}${encodeURIComponent(tab)}`;
        process.stdout.write(`  Testing [${r.name}] -> ${tab}... `);
        const t0 = Date.now();
        let status = 'PASS';
        let errorMsg = null;

        try {
          await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 15000 });
          // Check for critical crash text
          const bodyText = await page.evaluate(() => document.body.innerText);
          if (bodyText.includes('Application error') || bodyText.includes('Internal Server Error')) {
            status = 'FAIL';
            errorMsg = 'Server or Application crash detected';
          }
        } catch (e) {
          status = 'FAIL';
          errorMsg = e.message;
        }

        const durationMs = Date.now() - t0;
        console.log(`${status} (${durationMs}ms)`);
        crawlReport.details.push({
          route: targetUrl,
          role: r.name,
          tab,
          durationMs,
          status,
          error: errorMsg
        });

        crawlReport.tested++;
        if (status === 'PASS') crawlReport.passed++;
        else crawlReport.failed++;
      }
    }

    crawlReport.untested = crawlReport.totalDiscoverable - crawlReport.tested;
    if (crawlReport.untested < 0) crawlReport.untested = 0;

    console.log('\n======================================================');
    console.log('DEEP-CRAWL PRODUCTION SUMMARY');
    console.log('======================================================');
    console.log(`Total Discoverable Routes: ${crawlReport.totalDiscoverable}`);
    console.log(`Tested: ${crawlReport.tested}`);
    console.log(`Untested: ${crawlReport.untested}`);
    console.log(`Passed: ${crawlReport.passed}`);
    console.log(`Failed: ${crawlReport.failed}`);
    console.log(`Console Errors: ${crawlReport.consoleErrors.length}`);
    console.log('======================================================\n');

    fs.writeFileSync(path.join(__dirname, 'deep-crawl-results.json'), JSON.stringify(crawlReport, null, 2));

  } catch (err) {
    console.error('Fatal Crawl Error:', err);
  } finally {
    await browser.close();
  }
}

deepCrawl();
