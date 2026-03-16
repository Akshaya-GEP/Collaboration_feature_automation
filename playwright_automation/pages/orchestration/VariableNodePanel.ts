import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';

export class VariableNodePanel {
  constructor(private readonly page: Page) {}

  private get closePanelButton(): Locator {
    return this.page.getByRole('button', { name: /close panel/i });
  }

  /** State updates / variable updates section: "Add state", "Add State Update" or similar */
  private get addStateUpdateButton(): Locator {
    return this.page.getByRole('button', { name: /add state|add state update|add variable/i }).first();
  }

  /** Variable/field name input (placeholder "Select Variable" or "Select variable") */
  private get variableField(): Locator {
    return this.page.getByPlaceholder(/select variable/i).first();
  }

  /** Value input for the variable update */
  private get valueInput(): Locator {
    return this.page.getByPlaceholder('Value').first().or(
      this.page.locator('input').filter({ hasNot: this.page.getByPlaceholder(/select variable/i) }).first()
    );
  }

  /**
   * Add or set a variable update: variable/field name and value (e.g. fieldName "flow.Year", value "{{system.userQuery}}").
   */
  async setVariableUpdate(options: { fieldName: string; value: string }): Promise<void> {
    const { fieldName, value } = options;
    const addVisible = await this.addStateUpdateButton.isVisible({ timeout: 3_000 }).catch(() => false);
    if (addVisible) {
      await this.addStateUpdateButton.click();
      await this.page.waitForTimeout(500);
    }

    const variableInput = this.variableField;
    await expect(variableInput).toBeVisible({ timeout: 10_000 });
    await variableInput.click();
    await variableInput.fill(fieldName);
    await this.page.waitForTimeout(300);

    const valueField = this.valueInput;
    if (await valueField.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await valueField.fill(value);
    } else {
      await this.page.locator('input').last().fill(value);
    }
    await this.page.waitForTimeout(400);
    console.log(`Variable node: set ${fieldName} = ${value}`);
  }

  /**
   * Assert that a variable update is visible (for collaboration sync check in Browser B).
   */
  async expectVariableUpdateVisible(options: { fieldName: string; value: string }): Promise<void> {
    const { fieldName, value } = options;
    await expect(this.page.getByText(fieldName)).toBeVisible({ timeout: 15_000 });
    await expect(this.page.getByText(value)).toBeVisible({ timeout: 5_000 });
    console.log('Variable node: update reflected in panel');
  }

  async closePanel(): Promise<void> {
    if (await this.closePanelButton.isVisible().catch(() => false)) {
      await this.closePanelButton.click();
    } else {
      await this.page.keyboard.press('Escape').catch(() => {});
    }
    await this.page.waitForTimeout(800);
  }
}
