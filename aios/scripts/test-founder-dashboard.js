const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/asus/.gemini/antigravity-ide/brain/f25f5f21-5be3-4664-a209-808bea5d945e';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'live_test_screenshots');

async function testFounderDashboard() {
  console.log('Testing Founder Dashboard Flow...');
  const browser = await puppeteer.launch({
    channel: 'chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  try {
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle2' });

    console.log('Clicking "Demo as Founder"...');
    const founderBtn = await page.waitForSelector('button::-p-text("Demo as Founder")', { timeout: 10000 });
    await founderBtn.click();

    console.log('Waiting for URL to become /dashboard/founder...');
    await page.waitForFunction(() => window.location.pathname.includes('/dashboard/founder'), { timeout: 15000 });
    await page.waitForNetworkIdle({ idleTime: 1000, timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));

    console.log('Current URL:', page.url());
    const founderOverview = path.join(SCREENSHOT_DIR, '13_founder_overview.png');
    await page.screenshot({ path: founderOverview, fullPage: true });
    console.log('Saved screenshot:', founderOverview);

    // Test key Founder tabs: Institutes, System Health, Audit Logs
    const tabs = [
      { name: 'Institutes', url: 'http://localhost:3000/dashboard/founder?nav=Institutes', file: '14_founder_institutes.png' },
      { name: 'System Health', url: 'http://localhost:3000/dashboard/founder?nav=System%20Health', file: '15_founder_health.png' },
      { name: 'Audit Logs', url: 'http://localhost:3000/dashboard/founder?nav=Audit%20Logs', file: '16_founder_audit_logs.png' }
    ];

    for (const t of tabs) {
      console.log(`Navigating to Founder: ${t.name}...`);
      await page.goto(t.url, { waitUntil: 'networkidle2' });
      await new Promise(r => setTimeout(r, 1500));
      const shot = path.join(SCREENSHOT_DIR, t.file);
      await page.screenshot({ path: shot, fullPage: true });
      console.log(`Saved screenshot: ${shot}`);
    }

    console.log('\n=============================================');
    console.log('FOUNDER DASHBOARD TEST COMPLETE');
    console.log(`Console Errors: ${errors.filter(e => !e.includes('GSI_LOGGER')).length}`);
    console.log('=============================================\n');

  } catch (err) {
    console.error('Error testing Founder Dashboard:', err);
  } finally {
    await browser.close();
  }
}

testFounderDashboard();
