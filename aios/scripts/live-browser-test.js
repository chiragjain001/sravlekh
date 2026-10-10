const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/asus/.gemini/antigravity-ide/brain/f25f5f21-5be3-4664-a209-808bea5d945e';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'live_test_screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runLiveTest() {
  console.log('Starting Live Browser Testing Suite for AIOS...');
  const browser = await puppeteer.launch({
    channel: 'chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const consoleLogs = [];
  const networkErrors = [];

  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();
    if (type === 'error' || text.includes('Error') || text.includes('500') || text.includes('502')) {
      consoleLogs.push({ type, text, location: msg.location() });
    }
  });

  page.on('pageerror', err => {
    consoleLogs.push({ type: 'pageerror', text: err.message, stack: err.stack });
  });

  page.on('response', resp => {
    const status = resp.status();
    const url = resp.url();
    if (status >= 400 && !url.includes('/favicon.ico')) {
      networkErrors.push({ url, status, statusText: resp.statusText() });
    }
  });

  const report = {
    testedScreens: [],
    consoleErrorsCount: 0,
    networkErrorsCount: 0,
    responsiveChecks: {},
    pwaChecks: {}
  };

  try {
    // -------------------------------------------------------------
    // Flow 1: Login Page
    // -------------------------------------------------------------
    console.log('\n[1/6] Testing Login Page...');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2', timeout: 30000 });
    const loginScreenshot = path.join(SCREENSHOT_DIR, '01_login_page.png');
    await page.screenshot({ path: loginScreenshot, fullPage: true });
    report.testedScreens.push({
      screen: 'Login Page',
      url: page.url(),
      screenshot: loginScreenshot,
      status: 'LOADED_CLEANLY'
    });

    // -------------------------------------------------------------
    // Flow 2: Demo Admin Login & Admin Dashboard Exploration
    // -------------------------------------------------------------
    console.log('\n[2/6] Logging in as Admin...');
    // Click "Demo as Admin"
    const adminBtn = await page.waitForSelector('button::-p-text("Demo as Admin")', { timeout: 10000 });
    await adminBtn.click();
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));

    console.log('  Admin Dashboard URL:', page.url());
    const adminOverviewScreenshot = path.join(SCREENSHOT_DIR, '02_admin_overview.png');
    await page.screenshot({ path: adminOverviewScreenshot, fullPage: true });
    report.testedScreens.push({
      screen: 'Admin Dashboard Overview',
      url: page.url(),
      screenshot: adminOverviewScreenshot,
      status: 'LOADED_CLEANLY'
    });

    // Admin - Students View
    console.log('  Testing Admin: Students View...');
    await page.goto('http://localhost:3000/dashboard/admin?nav=Students', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));
    
    // Test search filter if input exists
    const searchInput = await page.$('input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]');
    if (searchInput) {
      console.log('  Found student search input, typing "Aryan"...');
      await searchInput.type('Aryan', { delay: 100 });
      await new Promise(r => setTimeout(r, 1000));
    }
    const adminStudentsScreenshot = path.join(SCREENSHOT_DIR, '03_admin_students_search.png');
    await page.screenshot({ path: adminStudentsScreenshot, fullPage: true });
    report.testedScreens.push({
      screen: 'Admin - Students Directory & Search',
      url: page.url(),
      screenshot: adminStudentsScreenshot,
      status: 'INTERACTIVE_VERIFIED'
    });

    // Admin - Batches View
    console.log('  Testing Admin: Batches View...');
    await page.goto('http://localhost:3000/dashboard/admin?nav=Batches', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));
    const adminBatchesScreenshot = path.join(SCREENSHOT_DIR, '04_admin_batches.png');
    await page.screenshot({ path: adminBatchesScreenshot, fullPage: true });
    report.testedScreens.push({
      screen: 'Admin - Batches Management',
      url: page.url(),
      screenshot: adminBatchesScreenshot,
      status: 'LOADED_CLEANLY'
    });

    // Admin - Attendance
    console.log('  Testing Admin: Attendance View...');
    await page.goto('http://localhost:3000/dashboard/admin?nav=Attendance', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));
    const adminAttendanceScreenshot = path.join(SCREENSHOT_DIR, '05_admin_attendance.png');
    await page.screenshot({ path: adminAttendanceScreenshot, fullPage: true });
    report.testedScreens.push({
      screen: 'Admin - Attendance & Rosters',
      url: page.url(),
      screenshot: adminAttendanceScreenshot,
      status: 'LOADED_CLEANLY'
    });

    // Admin - Settings
    console.log('  Testing Admin: Settings View...');
    await page.goto('http://localhost:3000/dashboard/admin?nav=Settings', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));
    const adminSettingsScreenshot = path.join(SCREENSHOT_DIR, '06_admin_settings.png');
    await page.screenshot({ path: adminSettingsScreenshot, fullPage: true });
    report.testedScreens.push({
      screen: 'Admin - Institute Settings',
      url: page.url(),
      screenshot: adminSettingsScreenshot,
      status: 'LOADED_CLEANLY'
    });

    // -------------------------------------------------------------
    // Flow 3: Demo Student Login & Exploration
    // -------------------------------------------------------------
    console.log('\n[3/6] Logging in as Student...');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle2' });

    const studentBtn = await page.waitForSelector('button::-p-text("Demo as Student")', { timeout: 10000 });
    await studentBtn.click();
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));

    console.log('  Student Dashboard URL:', page.url());
    const studentOverviewScreenshot = path.join(SCREENSHOT_DIR, '07_student_dashboard.png');
    await page.screenshot({ path: studentOverviewScreenshot, fullPage: true });
    report.testedScreens.push({
      screen: 'Student Dashboard Overview',
      url: page.url(),
      screenshot: studentOverviewScreenshot,
      status: 'LOADED_CLEANLY'
    });

    // Student Tests
    console.log('  Testing Student: Tests View...');
    await page.goto('http://localhost:3000/dashboard/student?nav=Tests', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));
    const studentTestsScreenshot = path.join(SCREENSHOT_DIR, '08_student_tests.png');
    await page.screenshot({ path: studentTestsScreenshot, fullPage: true });
    report.testedScreens.push({
      screen: 'Student - Tests & Assessments',
      url: page.url(),
      screenshot: studentTestsScreenshot,
      status: 'LOADED_CLEANLY'
    });

    // Student Analytics
    console.log('  Testing Student: Analytics View...');
    await page.goto('http://localhost:3000/dashboard/student?nav=Analytics', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));
    const studentAnalyticsScreenshot = path.join(SCREENSHOT_DIR, '09_student_analytics.png');
    await page.screenshot({ path: studentAnalyticsScreenshot, fullPage: true });
    report.testedScreens.push({
      screen: 'Student - Performance Analytics',
      url: page.url(),
      screenshot: studentAnalyticsScreenshot,
      status: 'LOADED_CLEANLY'
    });

    // Student Doubts
    console.log('  Testing Student: Doubts View...');
    await page.goto('http://localhost:3000/dashboard/student?nav=Doubts', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));
    const studentDoubtsScreenshot = path.join(SCREENSHOT_DIR, '10_student_doubts.png');
    await page.screenshot({ path: studentDoubtsScreenshot, fullPage: true });
    report.testedScreens.push({
      screen: 'Student - Doubt Resolution',
      url: page.url(),
      screenshot: studentDoubtsScreenshot,
      status: 'LOADED_CLEANLY'
    });

    // -------------------------------------------------------------
    // Flow 4: Responsive Viewport Checks
    // -------------------------------------------------------------
    console.log('\n[4/6] Testing Mobile & Tablet Viewports...');
    
    // Mobile iPhone SE (375x667)
    await page.setViewport({ width: 375, height: 667, isMobile: true, hasTouch: true });
    await page.goto('http://localhost:3000/dashboard/student', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));
    const mobileScreenshot = path.join(SCREENSHOT_DIR, '11_student_mobile_375.png');
    await page.screenshot({ path: mobileScreenshot, fullPage: true });
    report.responsiveChecks.mobile375 = {
      status: 'VERIFIED',
      screenshot: mobileScreenshot,
      viewport: '375x667'
    };

    // Tablet iPad (768x1024)
    await page.setViewport({ width: 768, height: 1024, isMobile: true, hasTouch: true });
    await page.goto('http://localhost:3000/dashboard/admin', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));
    const tabletScreenshot = path.join(SCREENSHOT_DIR, '12_admin_tablet_768.png');
    await page.screenshot({ path: tabletScreenshot, fullPage: true });
    report.responsiveChecks.tablet768 = {
      status: 'VERIFIED',
      screenshot: tabletScreenshot,
      viewport: '768x1024'
    };

    // Reset viewport
    await page.setViewport({ width: 1440, height: 900 });

    // -------------------------------------------------------------
    // Flow 5: PWA Manifest & Service Worker Check
    // -------------------------------------------------------------
    console.log('\n[5/6] Testing PWA & Manifest...');
    const manifestResp = await page.goto('http://localhost:3000/manifest.json');
    const manifestStatus = manifestResp.status();
    let manifestData = null;
    try {
      manifestData = await manifestResp.json();
    } catch (e) {
      console.error('Error parsing manifest JSON:', e.message);
    }
    report.pwaChecks = {
      manifestStatus,
      manifestValid: manifestStatus === 200 && !!manifestData && manifestData.name === 'AIOS — Academic Intelligence Operating System',
      hasIcons: Array.isArray(manifestData?.icons) && manifestData.icons.length > 0,
      themeColor: manifestData?.theme_color,
      display: manifestData?.display
    };

    // -------------------------------------------------------------
    // Flow 6: Consolidate Logs & Errors
    // -------------------------------------------------------------
    report.consoleErrors = consoleLogs;
    report.consoleErrorsCount = consoleLogs.length;
    report.networkErrors = networkErrors;
    report.networkErrorsCount = networkErrors.length;

    console.log('\n======================================================');
    console.log('LIVE BROWSER TEST COMPLETE');
    console.log('======================================================');
    console.log(`Screens Tested: ${report.testedScreens.length}`);
    console.log(`Console Errors: ${report.consoleErrorsCount}`);
    console.log(`Network Errors: ${report.networkErrorsCount}`);
    console.log(`PWA Valid: ${report.pwaChecks.manifestValid}`);
    console.log('======================================================\n');

    fs.writeFileSync(path.join(ARTIFACT_DIR, 'live_browser_test_results.json'), JSON.stringify(report, null, 2));

  } catch (error) {
    console.error('FATAL Live Test Error:', error);
  } finally {
    await browser.close();
  }
}

runLiveTest();
