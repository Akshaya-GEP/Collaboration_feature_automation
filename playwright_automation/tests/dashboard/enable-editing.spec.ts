import { test, expect } from '@playwright/test';
import { Sidebar } from '../../pages/components/Sidebar';
import { login } from '../../pages/auth/loginhelper';
import { configureDomain } from '../../pages/config/domainhelper';
import { envFirst } from '../helpers/env';

const appUrl = envFirst('APP_URL') ?? 'https://dev-qi.gep.com/?dc=eyJjIjoiREVWRUxPUEVSRE9NQUlOIiwiZCI6IjIwMjEwNTExIiwiZSI6IkRFViIsImEiOiJmMzAxMzFkOS0yM2VmLTQ4YjItODI2Ni1mOWIxNGUwZGNhOTYiLCJtIjoiYzM0MTRjOTQtZDg4My00MjBlLWJhMGUtNTdhZTIyNzg4NjMwIiwibiI6IkRFVkVMT1BFUkRPTUFJTiIsInYiOiJ2MTc3MzUwNzY1NzM4MzYyMTQwMCJ9';
const skipLogin = envFirst('SKIP_LOGIN');
const freshBrowser = envFirst('FRESH_BROWSER');

test.use({ storageState: freshBrowser ? undefined : 'auth.json' });

test.describe('Dashboard - Enable Editing', () => {
  test('Enable editing, create draft, then close and verify Agents link', async ({ page }) => {
    test.setTimeout(120_000);

    // -------- NAVIGATE TO APP --------
    await page.goto(appUrl, { waitUntil: 'domcontentloaded' });

    // -------- LOGIN (if redirected to Microsoft sign-in) --------
    if (!skipLogin) {
      const emailInput = page.locator('#i0116, input[type="email"]');
      const passwordInput = page.locator('#i0118, input[type="password"]').or(page.getByPlaceholder(/password/i));
      const emailVisible = await emailInput.isVisible({ timeout: 25000 }).catch(() => false);
      const passwordVisible = await passwordInput.isVisible({ timeout: 25000 }).catch(() => false);
      if (emailVisible || passwordVisible) {
        await login(page);
        await page.goto(appUrl);
        await page.waitForLoadState('domcontentloaded');
      }
    }

    // -------- DOMAIN CONFIG --------
    await configureDomain(page);

    // -------- GO TO DASHBOARD --------
    const sidebar = new Sidebar(page);
    await sidebar.goToDashboard();
    await page.waitForLoadState('domcontentloaded');

    // -------- PUBLISH CHEVRON → VERSION HISTORY (immediately) → FIRST ROW VIEW --------
    const publishGroup = page.getByRole('button', { name: /publish/i }).locator('..');
    const chevronButton = publishGroup.locator('button[aria-haspopup="menu"]').filter({ has: page.locator('svg.lucide-chevron-down') });
    await expect(chevronButton.first()).toBeVisible({ timeout: 10_000 });
    await chevronButton.first().click();
    await page.getByRole('menuitem', { name: /version history/i }).click();
    await page.waitForTimeout(1000);

    const firstRow = page.locator('table tbody tr').first();
    const eyeButton = firstRow.locator('button').filter({ has: page.locator('svg.lucide-eye') });
    await expect(eyeButton.first()).toBeVisible({ timeout: 10_000 });
    await eyeButton.first().hover();
    await page.waitForTimeout(300);
    await eyeButton.first().click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForLoadState('load', { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // -------- ENABLE EDITING FLOW --------
    await expect(page.getByRole('button', { name: 'Enable Editing' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Enable Editing' }).click();
    await expect(page.getByRole('dialog', { name: 'Enable editing?' })).toBeVisible();

    await page.getByRole('button', { name: 'Create draft' }).click();
    await expect(page.getByRole('dialog', { name: 'Draft Created' })).toBeVisible();

    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('link', { name: 'Agents Create and manage AI' })).toBeVisible();

    // -------- USER PROFILE: ENABLE EXPERIMENTAL FEATURES & CLOSE POPUP --------
    await page.getByRole('button', { name: 'AR' }).click();
    const profileMenu = page.getByRole('menu', { name: 'AR' });
    await expect(profileMenu).toBeVisible({ timeout: 5000 });
    await expect(profileMenu.getByText('Experimental Features')).toBeVisible();

    const experimentalSwitch = profileMenu.getByRole('switch');
    await expect(experimentalSwitch).toBeVisible();
    if ((await experimentalSwitch.getAttribute('aria-checked')) !== 'true') {
      await experimentalSwitch.click();
    }
    // If already enabled, go next: close popup and dblclick people icon
    await page.keyboard.press('Escape');
    await expect(page.getByText('Experimental Features')).toBeHidden({ timeout: 3000 });

    // -------- PEOPLE ICON (double-click) → INVITE COLLABORATORS --------
    const peopleIcon = page.locator('button').filter({ has: page.locator('svg.lucide-users') }).first();
    await expect(peopleIcon).toBeVisible({ timeout: 5000 });
    await peopleIcon.dblclick();
    await expect(page.getByRole('dialog', { name: /invite collaborators/i })).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(1500);
    await expect(page.getByPlaceholder('name@gep.com')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Invite' })).toBeVisible();
    await page.getByPlaceholder('name@gep.com').fill('vignesh.voddam@gep.com');
    await page.getByRole('button', { name: 'Invite' }).click();
    await page.waitForTimeout(3000);
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('dialog', { name: /invite collaborators/i })).toBeHidden({ timeout: 3000 });
  });
});
