import { Page } from '@playwright/test';
import { LoginPage } from './LoginPage';

/**
 * Log in using the same flow as Browser A (LoginPage: email → Next → password → Sign in).
 * If email/password are provided (e.g. for Browser B), use them; otherwise use USER_EMAIL / USER_PASSWORD from env.
 */
export async function login(
  page: Page,
  email?: string,
  password?: string,
  loginUrl?: string
) {
  const loginPage = new LoginPage(page);
  const env = typeof process !== 'undefined' ? process.env : {};
  const useEmail = email ?? env.USER_EMAIL ?? '';
  const usePassword = password ?? env.USER_PASSWORD ?? '';
  const useLoginUrl = loginUrl ?? env.LOGIN_URL ?? '';

  const emailVisible = await loginPage.emailInput.isVisible({ timeout: 3000 }).catch(() => false);
  const passwordVisible = await loginPage.passwordInput.isVisible({ timeout: 3000 }).catch(() => false);
  if (!emailVisible && !passwordVisible && useLoginUrl) {
    await page.goto(useLoginUrl);
    await page.waitForLoadState('domcontentloaded');
  }

  const showEmail = await loginPage.emailInput.isVisible({ timeout: 5000 }).catch(() => false);
  if (showEmail && useEmail) {
    await loginPage.enterEmail(useEmail);
  }
  await loginPage.enterPassword(usePassword);

  if (await loginPage.staySignedInYesButton.isVisible({ timeout: 10000 }).catch(() => false)) {
    await loginPage.confirmStaySignedIn();
  }

  await page.waitForLoadState('load', { timeout: 60000 });
}

/**
 * Log in with explicit credentials (e.g. for a second user / Browser B in collaboration tests).
 * Use LOGIN_URL from env if loginUrl is not provided.
 * Handles Microsoft "Pick an account" by clicking "Use another account" so the email field appears.
 */
export async function loginWithCredentials(
  page: Page,
  email: string,
  password: string,
  loginUrl?: string
) {
  const url = loginUrl ?? (typeof process !== 'undefined' && process.env?.LOGIN_URL) ?? '';
  const loginPage = new LoginPage(page);

  // Wait for any known Microsoft login surface (email, password, or "Pick an account")
  const useAnotherAccount = page
    .getByRole('button', { name: /use another account/i })
    .or(page.getByRole('link', { name: /use another account/i }));
  await Promise.race([
    loginPage.emailInput.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {}),
    loginPage.passwordInput.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {}),
    useAnotherAccount.first().waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {}),
  ]).catch(() => {});

  const emailVisible = await loginPage.emailInput.isVisible({ timeout: 3000 }).catch(() => false);
  const passwordVisible = await loginPage.passwordInput.isVisible({ timeout: 3000 }).catch(() => false);
  if (!emailVisible && !passwordVisible && url) {
    await page.goto(url);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
  }

  // If "Pick an account" is shown, click "Use another account" so we get the email field
  if (await useAnotherAccount.first().isVisible({ timeout: 3000 }).catch(() => false)) {
    await useAnotherAccount.first().click();
    await page.waitForTimeout(1500);
  }

  // Wait for email field and fill (Microsoft may show email first; field can be pre-filled)
  const emailField = page.locator('#i0116').or(page.locator('input[type="email"]')).or(page.locator('input[name="loginfmt"]')).first();
  const showEmail = await emailField.isVisible({ timeout: 15_000 }).catch(() => false);
  if (showEmail) {
    await emailField.waitFor({ state: 'visible' });
    await emailField.click();
    await emailField.press('Control+a');
    await emailField.fill(email);
    await page.waitForTimeout(500);
    const nextBtn = page.locator('#idSIButton9').or(page.getByRole('button', { name: /^next$/i })).first();
    await nextBtn.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
    if (await nextBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await nextBtn.click();
    }
    await page.waitForTimeout(2000);
  }

  await loginPage.passwordInput.waitFor({ state: 'visible', timeout: 15_000 });
  await loginPage.passwordInput.fill(password);
  const signInBtn = page.getByRole('button', { name: /sign in/i }).first();
  if (await signInBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await signInBtn.click();
  }

  if (await loginPage.staySignedInYesButton.isVisible({ timeout: 10000 }).catch(() => false)) {
    await loginPage.confirmStaySignedIn();
  }

  await page.waitForLoadState('load', { timeout: 60000 });
}
