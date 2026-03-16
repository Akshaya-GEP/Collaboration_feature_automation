import { test, chromium } from '@playwright/test';

test('Save logged-in state', async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(process.env.LOGIN_URL!);
  await page.waitForLoadState('domcontentloaded');

  // Microsoft may show email first, or directly ask for password (e.g. when email is cached)
  const emailInput = page.locator('#i0116').or(page.locator('input[type="email"]'));
  const emailVisible = await emailInput.isVisible({ timeout: 5000 }).catch(() => false);
  if (emailVisible) {
    await emailInput.fill(process.env.USER_EMAIL!);
    await page.getByRole('button', { name: /next/i }).click();
    await page.waitForLoadState('domcontentloaded');
  }

  const passwordInput = page.locator('#i0118').or(page.locator('input[type="password"]'));
  await passwordInput.waitFor({ state: 'visible', timeout: 10000 });
  await passwordInput.fill(process.env.USER_PASSWORD!);
  await page.getByRole('button', { name: /sign in/i }).click();

  // Handle Stay Signed In: check "Don't show this again", then click Yes
  const yesButton = page.getByRole('button', { name: /^yes$/i });
  if (await yesButton.isVisible({ timeout: 10000 }).catch(() => false)) {
    const dontShowAgain = page.getByRole('checkbox', { name: /don'?t show this again/i });
    if (await dontShowAgain.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dontShowAgain.check();
    }
    await yesButton.click();
  }

  await page.waitForLoadState('load', { timeout: 60000 });
  await context.storageState({ path: 'auth.json' });
  await browser.close();
});
