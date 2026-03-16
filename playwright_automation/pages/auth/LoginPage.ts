import { Page, Locator } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly nextButton: Locator;
  readonly passwordInput: Locator;
  readonly signInButton: Locator;
  readonly staySignedInYesButton: Locator;
  readonly dontShowAgainCheckbox: Locator;

  constructor(page: Page) {
    this.page = page;
    // Microsoft login: #i0116 = email, #i0118 = password
    this.emailInput = page.locator('#i0116').or(page.locator('input[type="email"]'));
    this.nextButton = page.getByRole('button', { name: /next/i });
    this.passwordInput = page.locator('#i0118').or(page.locator('input[type="password"]'));
    this.signInButton = page.getByRole('button', { name: /sign in/i });
    this.staySignedInYesButton = page.getByRole('button', { name: /^yes$/i });
    this.dontShowAgainCheckbox = page.getByRole('checkbox', { name: /don'?t show this again/i });
  }

  async enterEmail(email: string) {
    await this.emailInput.waitFor({ state: 'visible' });
    await this.emailInput.fill(email);
    await this.nextButton.click();
  }

  async enterPassword(password: string) {
    await this.passwordInput.waitFor({ state: 'visible' });
    await this.passwordInput.fill(password);
    await this.signInButton.click();
  }

  async confirmStaySignedIn() {
    // Check "Don't show this again" to avoid prompt on future logins
    if (await this.dontShowAgainCheckbox.isVisible({ timeout: 3000 }).catch(() => false)) {
      await this.dontShowAgainCheckbox.check();
    }
    await this.staySignedInYesButton.waitFor({ state: 'visible' });
    await this.staySignedInYesButton.click();
  }
}
