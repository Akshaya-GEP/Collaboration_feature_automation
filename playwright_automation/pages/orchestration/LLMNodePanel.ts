import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';

export class LLMNodePanel {
  constructor(private readonly page: Page) {}

  private get closePanelButton() {
    return this.page.getByRole('button', { name: /close panel/i });
  }

  private get nodeNameInput(): Locator {
    // In the current UI, this field is labeled as "Add name..."
    // (Playwright snapshot shows: textbox "Add name..." value: llm_0)
    return this.page
      .getByRole('textbox', { name: /add name/i })
      .or(this.page.getByPlaceholder(/add name/i))
      // fallbacks for future UI tweaks
      .or(this.page.getByRole('textbox', { name: /name/i }))
      .or(this.page.getByPlaceholder(/^name$/i));
  }

  private get modelDropdown(): Locator {
    // Prefer a labeled combobox. Fall back to the first combobox in the panel.
    return this.page
      .getByRole('combobox', { name: /model/i })
      .or(this.page.getByRole('combobox').first());
  }

  async configureLLM(data: { nodeName?: string; model: string }) {
    console.log('Configuring LLM node...');
    await this.page.waitForTimeout(1000);

    if (data.nodeName) {
      console.log(`Setting node name: ${data.nodeName}`);
      await expect(this.nodeNameInput).toBeVisible({ timeout: 15_000 });
      await this.nodeNameInput.clear();
      await this.nodeNameInput.fill(data.nodeName);
      console.log(`✅ Node name set: ${data.nodeName}`);
      await this.page.waitForTimeout(300);
    }

    console.log(`Selecting model: ${data.model}`);
    await expect(this.modelDropdown).toBeVisible({ timeout: 15_000 });
    await expect(this.modelDropdown).toBeEnabled({ timeout: 5_000 });

    await this.modelDropdown.click();
    await this.page.waitForTimeout(500);

    const modelOption = this.page.getByRole('option', { name: data.model, exact: true });
    await expect(modelOption).toBeVisible({ timeout: 10_000 });
    await modelOption.click();

    console.log(`✅ Model selected: ${data.model}`);
    await this.page.waitForTimeout(800);
  }

  async closePanel() {
    console.log('Closing LLM configuration panel...');
    await expect(this.closePanelButton).toBeVisible({ timeout: 5_000 });
    await this.closePanelButton.click();
    await this.page.waitForTimeout(800);
    console.log('✅ LLM panel closed');
  }
}


