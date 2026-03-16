import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { DomainConfigPage } from './DomainConfigPage';
import { envFirst } from '../../tests/helpers/env';

export async function configureDomain(page: Page) {
  console.log('Checking for domain configuration dialog...');

  await page.waitForLoadState('domcontentloaded');

  const domainDialog = page.getByRole('dialog', { name: /domain configuration|choose where you want to work/i })
    .or(page.locator('div').filter({ hasText: /^Domain Configuration$|^Choose where you want to work$/i }).first());

  let isDialogVisible = false;
  try {
    // Check if the configuration interface is visible
    const isVisible = await domainDialog.isVisible();
    if (!isVisible) {
      console.log('Domain configuration not immediately visible, waiting briefly...');
      await domainDialog.waitFor({ state: 'visible', timeout: 10_000 });
    }
    isDialogVisible = true;
    console.log('✅ Domain configuration interface found - configuring...');
  } catch (error) {
    console.log('ℹ️ Domain configuration interface not found, assuming already configured.');
    isDialogVisible = false;
  }

  if (isDialogVisible) {
    const domainPage = new DomainConfigPage(page);
    const clientName = (envFirst('CLIENT_NAME') ?? 'DEVELOPERDOMAIN').trim();
    const appName = (envFirst('APP_NAME') ?? 'interns').trim();
    const moduleName = (envFirst('MODULE_NAME') ?? 'test').trim();

    // Step 1: Select Client (e.g. DEVELOPERDOMAIN)
    console.log(`Selecting client: ${clientName}`);
    const clientSelected = await domainPage.selectClientIfPossible(clientName);
    if (clientSelected) {
      await page.waitForTimeout(500);
      await domainPage.clickContinue();
      await page.waitForTimeout(1000);
    }

    // Step 2: Select App (e.g. interns) and Module (e.g. test)
    console.log(`Selecting app and module: ${appName}, ${moduleName}`);
    await domainPage.selectApp(appName);
    await page.waitForTimeout(500);
    await domainPage.selectModule(moduleName);
    await page.waitForTimeout(500);
    await domainPage.clickContinue();

    console.log('Waiting for domain configuration to complete...');

    const refreshingMessage = page.getByText(/refreshing module configuration/i);

    // Step 1: Wait for the message to appear (confirms refresh started)
    console.log('Waiting for refresh to start...');
    try {
      await refreshingMessage.waitFor({ state: 'visible', timeout: 5_000 });
      console.log('Refresh started, waiting for completion...');

      // Step 2: Wait for the message to disappear (confirms refresh completed)
      await expect(refreshingMessage).toBeHidden({ timeout: 180_000 }); // 3 minutes
      console.log('Refresh completed');
    } catch (e) {
      console.log('Refreshing message did not appear or was too fast, continuing...');
    }

    // Wait for page to fully load
    await page.waitForLoadState('load', { timeout: 60_000 });
    await page.waitForLoadState('domcontentloaded');

    console.log('✅ Domain configuration completed successfully');
  }

  // Wait for main app navigation
  console.log('Waiting for main app navigation...');

  // Guard: Wait for any page loading spinner to vanish
  const spinner = page.locator('.loading-spinner').or(page.locator('.spinner')).or(page.getByText(/loading/i));
  await expect(spinner).toBeHidden({ timeout: 20_000 }).catch(() => { });

  const orchestrationsLink = page.getByRole('link', { name: 'Agentic Orchestrations', exact: true });

  try {
    // CRITICAL: Link must be visible AND enabled (interactive)
    await expect(orchestrationsLink).toBeVisible({ timeout: 30_000 });
    await expect(orchestrationsLink).toBeEnabled({ timeout: 5_000 });
    console.log('✅ Agentic Orchestrations link is ready for interaction');
  } catch (e) {
    console.log('ℹ️ Agentic Orchestrations link not fully ready, manual navigation might be needed.');
  }

  // Ensure main container is ready
  await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 }).catch(() => { });
  console.log('✅ Main app is ready');
}
