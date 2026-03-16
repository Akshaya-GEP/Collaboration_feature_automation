import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';

export class GuardrailNodePanel {
  constructor(private readonly page: Page) {}

  private get closePanelButton() {
    return this.page.getByRole('button', { name: /close panel/i });
  }

  private get modelDropdown(): Locator {
    return this.page
      .getByRole('combobox', { name: /model/i })
      .or(this.page.getByRole('combobox').first());
  }

  private get nodeNameInput(): Locator {
    // Node header name field uses this placeholder across nodes (seen in snapshots)
    return this.page.getByRole('textbox', { name: /add name/i }).or(this.page.getByPlaceholder(/add name/i));
  }

  private get inputField(): Locator {
    // In the Guardrail UI, the "Input" control is typically a selector with placeholder:
    // "Select input variable..." (distinct from the node name field "Add name...").
    return this.page
      .getByRole('textbox', { name: /select input variable/i })
      .or(this.page.getByPlaceholder(/select input variable/i));
  }

  private checkRow(label: RegExp): Locator {
    // Find row/container for a given check label and operate within it.
    // Using a couple parent hops keeps it resilient to layout changes.
    const labelEl = this.page.getByText(label).first();
    return labelEl.locator('..').locator('..');
  }

  private async setToggle(row: Locator, enabled: boolean) {
    const toggle = row.getByRole('switch').first().or(row.getByRole('checkbox').first());
    await expect(toggle).toBeVisible({ timeout: 10_000 });

    const isChecked = await toggle.isChecked().catch(() => false);
    if (enabled !== isChecked) {
      await toggle.click();
    }
  }

  private settingsButton(row: Locator): Locator {
    // The "symbol" icon is typically a button inside the row.
    return row
      .getByRole('button', { name: /settings|configure|edit/i })
      .or(row.locator('button:has(svg)'))
      .last();
  }

  async selectModel(model: string) {
    console.log(`Guardrail: selecting model ${model}`);
    await expect(this.modelDropdown).toBeVisible({ timeout: 15_000 });
    await this.modelDropdown.click();
    await this.page.waitForTimeout(500);

    const opt = this.page.getByRole('option', { name: model, exact: true });
    await expect(opt).toBeVisible({ timeout: 10_000 });
    await opt.click();
    await this.page.waitForTimeout(500);
  }

  async setInput(value: string) {
    console.log('Guardrail: setting input');
    await expect(this.inputField).toBeVisible({ timeout: 15_000 });
    await this.inputField.click();
    await this.inputField.fill(value);
    await this.page.waitForTimeout(500);

    // If this field opens a dropdown, prefer selecting an exact match option when present.
    const opt = this.page.getByRole('option', { name: value, exact: true }).first();
    if (await opt.isVisible().catch(() => false)) {
      await opt.click();
    }

    await this.page.waitForTimeout(300);
  }

  async enablePersonallyIdentifiableInformation(enabled = true) {
    console.log(`Guardrail: PII check -> ${enabled ? 'ON' : 'OFF'}`);
    const row = this.checkRow(/personally identifiable information/i);
    await this.setToggle(row, enabled);
  }

  async enableJailbreak(enabled = true, settingsModel?: string) {
    console.log(`Guardrail: Jailbreak check -> ${enabled ? 'ON' : 'OFF'}`);
    const row = this.checkRow(/^jailbreak$/i);
    await this.setToggle(row, enabled);

    if (enabled && settingsModel) {
      const btn = this.settingsButton(row);
      await expect(btn).toBeVisible({ timeout: 10_000 });
      await btn.click();

      // Settings modal/panel: pick model
      const modelCombo = this.page.getByRole('combobox', { name: /model/i }).first();
      await expect(modelCombo).toBeVisible({ timeout: 10_000 });
      await modelCombo.click();
      const opt = this.page.getByRole('option', { name: settingsModel, exact: true });
      await expect(opt).toBeVisible({ timeout: 10_000 });
      await opt.click();

      // Close settings (best effort)
      const close = this.page.getByRole('button', { name: /^close$/i }).first();
      if (await close.isVisible().catch(() => false)) await close.click();
      else await this.page.keyboard.press('Escape').catch(() => {});
    }
  }

  async enableCustomPrompt(enabled = true, settingsModel?: string, systemPrompt?: string) {
    console.log(`Guardrail: Custom Prompt check -> ${enabled ? 'ON' : 'OFF'}`);
    const row = this.checkRow(/custom prompt/i);
    await this.setToggle(row, enabled);

    if (enabled && (settingsModel || systemPrompt)) {
      const btn = this.settingsButton(row);
      await expect(btn).toBeVisible({ timeout: 10_000 });
      await btn.click();

      if (settingsModel) {
        const modelCombo = this.page.getByRole('combobox', { name: /model/i }).first();
        await expect(modelCombo).toBeVisible({ timeout: 10_000 });
        await modelCombo.click();
        const opt = this.page.getByRole('option', { name: settingsModel, exact: true });
        await expect(opt).toBeVisible({ timeout: 10_000 });
        await opt.click();
      }

      if (systemPrompt) {
        const promptBox = this.page
          .getByRole('textbox', { name: /system prompt|prompt/i })
          .or(this.page.getByPlaceholder(/system prompt|prompt/i))
          .first();
        await expect(promptBox).toBeVisible({ timeout: 10_000 });
        await promptBox.fill(systemPrompt);
      }

      const close = this.page.getByRole('button', { name: /^close$/i }).first();
      if (await close.isVisible().catch(() => false)) await close.click();
      else await this.page.keyboard.press('Escape').catch(() => {});
    }
  }

  /**
   * Assert that the Input value is visible in the panel (for collaboration sync check in Browser B).
   */
  async expectInputValue(value: string): Promise<void> {
    await expect(this.page.getByText(value)).toBeVisible({ timeout: 15_000 });
    console.log(`Guardrail: input value reflected: ${value}`);
  }

  /**
   * Assert that the "Personally identifiable information" check is enabled (switch on) in the panel.
   */
  async expectPersonallyIdentifiableInformationEnabled(enabled = true): Promise<void> {
    const row = this.checkRow(/personally identifiable information/i);
    const toggle = row.getByRole('switch').first().or(row.getByRole('checkbox').first());
    await expect(toggle).toBeVisible({ timeout: 10_000 });
    if (enabled) {
      await expect(toggle).toBeChecked({ timeout: 5_000 });
    } else {
      await expect(toggle).not.toBeChecked({ timeout: 5_000 });
    }
    console.log(`Guardrail: PII check reflected as ${enabled ? 'ON' : 'OFF'}`);
  }

  async closePanel() {
    console.log('Closing guardrail configuration panel...');
    if (await this.closePanelButton.isVisible().catch(() => false)) {
      await this.closePanelButton.click();
    } else {
      await this.page.keyboard.press('Escape').catch(() => {});
    }
    await this.page.waitForTimeout(800);
  }
}


