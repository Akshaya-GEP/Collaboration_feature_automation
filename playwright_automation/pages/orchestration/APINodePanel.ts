import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';

export class APINodePanel {
  constructor(private readonly page: Page) {}

  private get closePanelButton() {
    return this.page.getByRole('button', { name: /close panel/i });
  }

  private get titleInput(): Locator {
    return this.page.getByPlaceholder('Add name...')
      .or(this.page.locator('input[placeholder*="name" i]').first())
      .first();
  }

  private get descriptionInput(): Locator {
    return this.page.getByPlaceholder('Add description...')
      .or(this.page.locator('textarea[placeholder*="description" i]').first())
      .or(this.page.locator('input[placeholder*="description" i]').first())
      .first();
  }

  // ─── Title ───

  async setTitle(title: string): Promise<void> {
    await expect(this.titleInput).toBeVisible({ timeout: 10_000 });
    await this.titleInput.click();
    await this.titleInput.clear();
    await this.titleInput.fill(title);
    await this.page.waitForTimeout(500);
    console.log(`✅ API title set to: ${title}`);
  }

  async expectTitle(expectedTitle: string): Promise<void> {
    await expect(this.titleInput).toHaveValue(expectedTitle.toLowerCase(), { timeout: 15_000 });
    console.log(`✅ API title verified: ${expectedTitle}`);
  }

  // ─── Description ───

  async setDescription(description: string): Promise<void> {
    await expect(this.descriptionInput).toBeVisible({ timeout: 10_000 });
    await this.descriptionInput.click();
    await this.descriptionInput.clear();
    await this.descriptionInput.fill(description);
    await this.page.waitForTimeout(500);
    console.log(`✅ API description set to: ${description}`);
  }

  async expectDescription(expectedDescription: string): Promise<void> {
    await expect(this.descriptionInput).toHaveValue(expectedDescription, { timeout: 15_000 });
    console.log(`✅ API description verified: ${expectedDescription}`);
  }

  // ─── HTTP Method (GET → POST, etc.) ───

  async selectMethod(method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'): Promise<void> {
    const methodTrigger = this.page.locator('button, [role="combobox"]')
      .filter({ hasText: /^(GET|POST|PUT|DELETE|PATCH)$/i })
      .first();
    await expect(methodTrigger).toBeVisible({ timeout: 10_000 });
    await methodTrigger.click();
    await this.page.waitForTimeout(500);

    const option = this.page.locator('[role="option"]')
      .filter({ hasText: new RegExp(`^${method}$`, 'i') })
      .first();
    await expect(option).toBeVisible({ timeout: 10_000 });
    await option.click();
    await this.page.waitForTimeout(500);
    console.log(`✅ HTTP method changed to: ${method}`);
  }

  async expectMethod(expectedMethod: string): Promise<void> {
    await expect(
      this.page.locator('button, [role="combobox"]')
        .filter({ hasText: new RegExp(`^${expectedMethod}$`, 'i') })
        .first()
    ).toBeVisible({ timeout: 15_000 });
    console.log(`✅ HTTP method verified: ${expectedMethod}`);
  }

  // ─── URL ───

  async setUrl(url: string): Promise<void> {
    const urlInput = this.page.getByPlaceholder(/enter url/i)
      .or(this.page.getByPlaceholder(/url or/i))
      .first();
    await expect(urlInput).toBeVisible({ timeout: 10_000 });
    await urlInput.click();
    await urlInput.clear();
    await urlInput.fill(url);
    await this.page.waitForTimeout(500);
    console.log(`✅ URL set to: ${url}`);
  }

  async expectUrl(expectedUrl: string): Promise<void> {
    const urlInput = this.page.getByPlaceholder(/enter url/i)
      .or(this.page.getByPlaceholder(/url or/i))
      .first();
    await expect(urlInput).toHaveValue(expectedUrl, { timeout: 15_000 });
    console.log(`✅ URL verified: ${expectedUrl}`);
  }

  // ─── Headers ───

  /**
   * Click "+ Add" next to Headers, then fill the header key and value.
   */
  async addHeader(key: string, value: string): Promise<void> {
    const headersSection = this.page.getByText('Headers', { exact: true }).first();
    await headersSection.scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(300);

    const addBtn = this.page.getByRole('button', { name: /\+\s*add/i })
      .or(headersSection.locator('..').getByRole('button', { name: /add/i }).first());
    await expect(addBtn.first()).toBeVisible({ timeout: 10_000 });
    await addBtn.first().click();
    await this.page.waitForTimeout(500);

    const keyInput = this.page.getByPlaceholder(/header name/i)
      .or(this.page.getByPlaceholder(/key/i))
      .last();
    await expect(keyInput).toBeVisible({ timeout: 10_000 });
    await keyInput.click();
    await keyInput.fill(key);
    await this.page.waitForTimeout(300);

    const valueInput = this.page.getByPlaceholder(/header value/i)
      .or(this.page.getByPlaceholder(/value/i))
      .last();
    await expect(valueInput).toBeVisible({ timeout: 10_000 });
    await valueInput.click();
    await valueInput.fill(value);
    await this.page.waitForTimeout(500);
    console.log(`✅ Header added: ${key}: ${value}`);
  }

  async expectHeaderVisible(key: string): Promise<void> {
    const headerByText = this.page.getByText(key, { exact: false }).first();
    const headerByInput = this.page.locator(`input[value="${key}"]`).first();
    const headerByPlaceholder = this.page.getByPlaceholder(/header name/i)
      .or(this.page.getByPlaceholder(/key/i));

    // Scroll headers into view
    const headersSection = this.page.getByText('Headers', { exact: true }).first();
    await headersSection.scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(500);

    await expect(headerByText.or(headerByInput).first()).toBeVisible({ timeout: 15_000 });
    console.log(`✅ Header "${key}" verified on this browser`);
  }

  // ─── Request Body (visible when method is POST/PUT/PATCH) ───

  async setRequestBody(body: string): Promise<void> {
    const bodyLabel = this.page.getByText('Request Body', { exact: false }).first();
    await bodyLabel.scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(300);

    const monacoEditor = this.page.locator('.monaco-editor').first();
    await expect(monacoEditor).toBeVisible({ timeout: 10_000 });
    await monacoEditor.click();
    await this.page.waitForTimeout(300);

    await this.page.keyboard.press('ControlOrMeta+a');
    await this.page.waitForTimeout(200);
    await this.page.keyboard.press('Backspace');
    await this.page.waitForTimeout(300);

    await this.page.keyboard.insertText(body);
    await this.page.waitForTimeout(500);
    console.log('✅ Request body set');
  }

  async expectBodyContains(text: string): Promise<void> {
    await expect(this.page.getByText(text).first()).toBeVisible({ timeout: 15_000 });
    console.log(`✅ Request body contains: "${text}"`);
  }

  // ─── Timeout ───

  async setTimeout(ms: string): Promise<void> {
    const timeoutInput = this.page.locator('input[type="number"], input')
      .filter({ has: this.page.locator('[value]') })
      .or(this.page.getByRole('spinbutton'))
      .last();

    // Fallback: find input near the "Timeout" label
    const timeoutLabel = this.page.getByText('Timeout', { exact: false }).first();
    await timeoutLabel.scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(300);

    const nearbyInput = timeoutLabel.locator('..').locator('..').locator('input').first()
      .or(timeoutInput);
    await expect(nearbyInput).toBeVisible({ timeout: 10_000 });
    await nearbyInput.click({ clickCount: 3 });
    await nearbyInput.fill(ms);
    await this.page.waitForTimeout(500);
    console.log(`✅ Timeout set to: ${ms} ms`);
  }

  async expectTimeout(expectedMs: string): Promise<void> {
    const timeoutLabel = this.page.getByText('Timeout', { exact: false }).first();
    await timeoutLabel.scrollIntoViewIfNeeded();
    const nearbyInput = timeoutLabel.locator('..').locator('..').locator('input').first()
      .or(this.page.getByRole('spinbutton').last());
    await expect(nearbyInput).toHaveValue(expectedMs, { timeout: 15_000 });
    console.log(`✅ Timeout verified: ${expectedMs} ms`);
  }

  // ─── State Update ───

  async ensureStateUpdateSectionOpen(): Promise<void> {
    const section = this.page.getByText('State Update', { exact: false }).first();
    await expect(section).toBeVisible({ timeout: 10_000 });
    await section.scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(300);

    const addBtn = this.page.getByRole('button', { name: /add state/i });
    const alreadyOpen = await addBtn.isVisible({ timeout: 2_000 }).catch(() => false);
    if (alreadyOpen) {
      console.log('✅ State Update section already open');
      return;
    }

    const expandButton = section.locator('..').locator('button').filter({ has: this.page.locator('svg') }).first()
      .or(this.page.getByRole('button', { name: /state update/i }).first())
      .or(section.locator('..').getByRole('button').first());
    await expandButton.click();
    await this.page.waitForTimeout(500);
    console.log('✅ State Update section expanded');
  }

  async addStateUpdate(variable: string, value: string): Promise<void> {
    await this.ensureStateUpdateSectionOpen();

    const addBtn = this.page.getByRole('button', { name: /add state/i });
    await addBtn.scrollIntoViewIfNeeded();
    await expect(addBtn).toBeVisible({ timeout: 10_000 });
    await addBtn.click();
    await this.page.waitForTimeout(500);

    const variableField = this.page.getByPlaceholder('Select variable').last();
    await expect(variableField).toBeVisible({ timeout: 10_000 });
    await variableField.click();
    await variableField.fill(variable);
    await this.page.waitForTimeout(300);
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(300);

    const valueArea = this.page.getByPlaceholder('Enter value')
      .or(this.page.getByPlaceholder('Select value'))
      .or(this.page.getByPlaceholder('Value'))
      .last();
    const valueVisible = await valueArea.isVisible({ timeout: 3_000 }).catch(() => false);
    if (valueVisible) {
      await valueArea.click();
      await valueArea.fill(value);
    } else {
      const valueCombobox = this.page.getByRole('combobox').last();
      await valueCombobox.click();
      await this.page.waitForTimeout(300);
      await this.page.keyboard.type(value, { delay: 50 });
    }
    await this.page.waitForTimeout(300);
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(500);
    console.log(`✅ State update added: variable="${variable}", value="${value}"`);
  }

  // ─── Panel ───

  async closePanel() {
    console.log('Closing API configuration panel...');
    if (await this.closePanelButton.isVisible().catch(() => false)) {
      await this.closePanelButton.click();
    } else {
      await this.page.keyboard.press('Escape').catch(() => {});
    }
    await this.page.waitForTimeout(800);
    console.log('✅ API panel closed');
  }
}
