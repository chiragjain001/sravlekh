const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/asus/.gemini/antigravity-ide/brain/f25f5f21-5be3-4664-a209-808bea5d945e';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'live_test_screenshots');

async function testStudentFlow() {
  console.log('Testing Student Dashboard Flow...');
  const browser = await puppeteer.launch({
    channel: 'chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on('console', msg => console.log('  [Student Browser]', msg.type(), msg.text()));

  try {
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
    
    // Clear storage and reload
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle2' });

    console.log('Clicking "Demo as Student"...');
    const studentBtn = await page.waitForSelector('button::-p-text("Demo as Student")', { timeout: 10000 });
    await studentBtn.click();

    // Wait for Next.js client router push
    console.log('Waiting for URL to become /dashboard/student...');
    await page.waitForFunction(() => window.location.pathname.includes('/dashboard/student'), { timeout: 15000 });
    await page.waitForNetworkIdle({ idleTime: 1000, timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));

    console.log('Current URL:', page.url());
    const studentOverview = path.join(SCREENSHOT_DIR, '07_student_dashboard_verified.png');
    await page.screenshot({ path: studentOverview, fullPage: true });
    console.log('Saved screenshot:', studentOverview);

    // Test Student sub-views
    const subviews = [
      { name: 'Tests', url: 'http://localhost:3000/dashboard/student?nav=Tests', file: '08_student_tests_verified.png' },
      { name: 'Analytics', url: 'http://localhost:3000/dashboard/student?nav=Analytics', file: '09_student_analytics_verified.png' },
      { name: 'Doubts', url: 'http://localhost:3000/dashboard/student?nav=Doubts', file: '10_student_doubts_verified.png' }
    ];

    for (const v of subviews) {
      console.log(`Navigating to Student: ${v.name}...`);
      await page.goto(v.url, { waitUntil: 'networkidle2' });
      await new Promise(r => setTimeout(r, 1500));
      const shot = path.join(SCREENSHOT_DIR, v.file);
      await page.screenshot({ path: shot, fullPage: true });
      console.log(`Saved screenshot: ${shot}`);
    }

    // Responsive Mobile Viewport for Student
    console.log('Testing Student Mobile Viewport (375x667)...');
    await page.setViewport({ width: 375, height: 667, isMobile: true, hasTouch: true });
    await page.goto('http://localhost:3000/dashboard/student', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));
    const mobileShot = path.join(SCREENSHOT_DIR, '11_student_mobile_verified.png');
    await page.screenshot({ path: mobileShot, fullPage: true });
    console.log('Saved screenshot:', mobileShot);

    console.log('Student live flow test completed successfully!');

  } catch (err) {
    console.error('Error during student flow test:', err);
  } finally {
    await browser.close();
  }
}

testStudentFlow();
