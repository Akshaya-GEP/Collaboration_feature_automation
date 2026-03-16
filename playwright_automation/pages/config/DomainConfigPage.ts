import { Page, Locator, expect } from '@playwright/test';

export class DomainConfigPage {
  readonly page: Page;
  readonly dialog: Locator;
  readonly clientInput: Locator;
  readonly continueButton: Locator;


  constructor(page: Page) {
    this.page = page;
    this.dialog = page.getByRole('dialog', { name: /domain configuration|choose where you want to work/i })
      .or(page.locator('div').filter({ hasText: /^Domain Configuration$|^Choose where you want to work$/i }).first());
    this.clientInput = page.getByRole('combobox').filter({ hasText: /Select Client/i })
      .or(page.getByRole('combobox').first());
    this.continueButton = page.getByRole('button', { name: /continue/i })
      .filter({ visible: true })
      .last();
  }

  async waitForPageToLoad() {
    await expect(this.clientInput).toBeVisible({ timeout: 30_000 });
    await expect(this.clientInput).toBeEnabled({ timeout: 30_000 });
  }

  async selectClientIfPossible(clientName: string): Promise<boolean> {
    const isVisible = await this.clientInput.isVisible({ timeout: 5000 }).catch(() => false);
    if (!isVisible) {
      console.log('Client selection dropdown not visible, skipping...');
      return false;
    }

    const currentText = await this.clientInput.innerText();
    if (currentText.includes(clientName)) {
      console.log(`Client ${clientName} already selected.`);
      return true;
    }

    await this.clientInput.click();
    await this.page.waitForTimeout(500);
    const searchInput = this.page.getByRole('textbox', { name: /search/i });
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.clear();
      await searchInput.fill(clientName);
      await this.page.waitForTimeout(500);
    }
    await this.page.getByText(clientName, { exact: true }).first().click();
    return true;
  }

  async clickContinue() {
    console.log('Clicking Continue button...');
    await expect(this.continueButton).toBeVisible({ timeout: 10_000 });
    await this.continueButton.scrollIntoViewIfNeeded();
    await this.continueButton.click({ force: true });
    await this.page.waitForTimeout(1000);
  }

  async selectApp(appName: string) {
    console.log(`🚀 Navigating to App: ${appName}`);

    // Click the app name directly; Playwright handles clicking the center of the text element.
    const appLabel = this.page.getByText(appName, { exact: true }).first();

    await expect(appLabel).toBeVisible({ timeout: 25_000 });
    await appLabel.scrollIntoViewIfNeeded();
    await appLabel.click({ force: true });

    console.log(`✅ App "${appName}" clicked.`);
    await this.page.waitForTimeout(2000); // Give modules time to refresh
  }

  async selectModule(moduleName: string) {
    console.log(`🚀 Navigating to Module: ${moduleName}`);

    // Wait for the modules section to be visible
    const modulesArea = this.page.getByText(/Modules/i).first();
    await expect(modulesArea).toBeVisible({ timeout: 15_000 });

    // Click the module name directly
    const moduleLabel = this.page.getByText(moduleName, { exact: true }).first();

    await expect(moduleLabel).toBeVisible({ timeout: 20_000 });
    await moduleLabel.scrollIntoViewIfNeeded();
    await moduleLabel.click({ force: true });

    console.log(`✅ Module "${moduleName}" clicked.`);
    await this.page.waitForTimeout(1000);
    await expect(this.continueButton).toBeEnabled({ timeout: 10_000 });
  }
}
