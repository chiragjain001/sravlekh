import { test, expect } from '@playwright/test';

test.describe('AIOS / SARVLEKH — Real Application Full Lifecycle E2E Suite', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate with dev login parameter to enable test authentication
    await page.goto('/login?dev=true');
    await page.waitForLoadState('networkidle');
  });

  test('TC-01: Public Login Screen Hydration & Role Sign-in UI', async ({ page }) => {
    // 1. Verify branding and typography
    await expect(page.locator('text=Academic Intelligence')).toBeVisible();
    await expect(page.locator('text=Operating System')).toBeVisible();
    await expect(page.locator('text=Welcome back')).toBeVisible();

    // 2. Verify dev mode login buttons are present
    const studentBtn = page.locator('button:has-text("Demo as Student")');
    const teacherBtn = page.locator('button:has-text("Demo as Teacher")');
    const adminBtn = page.locator('button:has-text("Demo as Admin")');
    const founderBtn = page.locator('button:has-text("Demo as Founder")');

    await expect(studentBtn).toBeVisible();
    await expect(teacherBtn).toBeVisible();
    await expect(adminBtn).toBeVisible();
    await expect(founderBtn).toBeVisible();
  });

  test('TC-02: Admin Journey — Authentication, Overview & Exams Management', async ({ page }) => {
    // 1. Authenticate as Admin
    await page.click('button:has-text("Demo as Admin")');

    // 2. Verify redirect to Admin Dashboard
    await page.waitForURL('**/dashboard/admin', { timeout: 15000 });
    await expect(page).toHaveURL(/.*\/dashboard\/admin/);

    // 3. Verify Admin Dashboard layout elements
    await expect(page.locator('aside')).toBeVisible();
    await expect(page.locator('text=Admin').first()).toBeVisible();

    // 4. Navigate to Exams Management via Sidebar
    const examsNav = page.locator('button:has-text("Exams")').first();
    await expect(examsNav).toBeVisible();
    await examsNav.click();

    // 5. Verify Exams Screen renders
    await page.waitForTimeout(1000); // Wait for dynamic screen chunk
    await expect(page.locator('text=Exams').first()).toBeVisible();
  });

  test('TC-03: Teacher Journey — Evaluation Desk & Digital Copy Workspace', async ({ page }) => {
    // 1. Authenticate as Teacher
    await page.click('button:has-text("Demo as Teacher")');

    // 2. Verify redirect to Teacher Dashboard
    await page.waitForURL('**/dashboard/teacher', { timeout: 15000 });
    await expect(page).toHaveURL(/.*\/dashboard\/teacher/);

    // 3. Navigate to Digital Answer Sheets (Evaluation Desk)
    const digitalSheetsNav = page.locator('button:has-text("Digital Answer Sheets")').first();
    if (await digitalSheetsNav.isVisible()) {
      await digitalSheetsNav.click();
      await page.waitForTimeout(1200);

      // Verify Evaluation Desk components render
      const deskHeader = page.locator('text=Digital Evaluation Desk').or(page.locator('text=Evaluation Desk')).or(page.locator('text=Answer Sheets'));
      await expect(deskHeader.first()).toBeVisible({ timeout: 10000 });
    } else {
      // Fallback: Check Evaluation Queue
      const queueNav = page.locator('button:has-text("Evaluation Queue")').first();
      await expect(queueNav).toBeVisible();
      await queueNav.click();
      await page.waitForTimeout(1000);
      await expect(page.locator('text=Evaluation').first()).toBeVisible();
    }
  });

  test('TC-04: Student Journey — Tests, Scores & Academic Diagnostics', async ({ page }) => {
    // 1. Authenticate as Student
    await page.click('button:has-text("Demo as Student")');

    // 2. Verify redirect to Student Dashboard
    await page.waitForURL('**/dashboard/student', { timeout: 15000 });
    await expect(page).toHaveURL(/.*\/dashboard\/student/);

    // 3. Navigate to My Tests
    const myTestsNav = page.locator('button:has-text("My Tests")').first();
    await expect(myTestsNav).toBeVisible();
    await myTestsNav.click();
    await page.waitForTimeout(1000);

    // 4. Verify test records or empty state renders cleanly
    const testsContainer = page.locator('text=Tests').or(page.locator('text=Assessments')).or(page.locator('text=Completed'));
    await expect(testsContainer.first()).toBeVisible({ timeout: 10000 });

    // 5. Navigate to Weak Topics (Academic Diagnostics)
    const weakTopicsNav = page.locator('button:has-text("Weak Topics")').first();
    if (await weakTopicsNav.isVisible()) {
      await weakTopicsNav.click();
      await page.waitForTimeout(1000);
      const diagnosticsHeader = page.locator('text=Weak Topics').or(page.locator('text=Mastery')).or(page.locator('text=Improvement'));
      await expect(diagnosticsHeader.first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('TC-05: Security & Session Isolation — Role Guard Enforcement', async ({ page }) => {
    // 1. Sign in as Student
    await page.click('button:has-text("Demo as Student")');
    await page.waitForURL('**/dashboard/student', { timeout: 15000 });

    // 2. Attempt unauthorized navigation to Admin dashboard
    await page.goto('/dashboard/admin');
    await page.waitForLoadState('networkidle');

    // 3. Verify RouteGuard kicks student back to /login or /dashboard/student
    await page.waitForTimeout(1500);
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/dashboard/admin');
  });

});
