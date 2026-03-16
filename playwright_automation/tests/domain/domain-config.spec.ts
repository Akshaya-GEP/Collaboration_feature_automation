import { test, expect } from '@playwright/test';
import { DomainConfigPage } from '../../pages/config/DomainConfigPage';

test.describe('Domain Configuration Flow', () => {
  test('Configure domain with valid client, app, and module', async ({ page }) => {
    test.setTimeout(120_000);
    const domainPage = new DomainConfigPage(page);

    // Navigate to domain config directly
    await page.goto('https://qistudio.gep.com/domain-config');

    // Wait for page elements
    await domainPage.waitForPageToLoad();

    // Select client, app, and module
    await domainPage.selectClient('DEVELOPERDOMAIN');
    await domainPage.clickContinue();

    await domainPage.selectApp('qistudioAutomation');
    await domainPage.selectModule('qistudioAutomation BaseModule');
    await domainPage.clickContinue();

    // Verify successful navigation
    //await expect(page).toHaveURL(/summary|review|workflow/i);
  });
});
