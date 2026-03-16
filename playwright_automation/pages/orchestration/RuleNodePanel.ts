import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';

export class RuleNodePanel {
  constructor(private readonly page: Page) {}

  // --- Header ---

  private get closePanelButton(): Locator {
    return this.page.getByRole('button', { name: /close panel/i });
  }

  /** Rule title display/edit area (e.g. "rule_0") */
  private get ruleTitle(): Locator {
    return this.page.getByText(/^rule_\d+$/i).first().or(this.page.getByRole('textbox', { name: /rule name|name/i }).first());
  }

  private get descriptionField(): Locator {
    return this.page.getByPlaceholder('Add description...').first();
  }

  private get editRuleButton(): Locator {
    return this.page.getByRole('button', { name: /edit/i }).first();
  }

  private get favoriteRuleButton(): Locator {
    return this.page.getByRole('button', { name: /favorite|star/i }).first();
  }

  private get codeViewButton(): Locator {
    return this.page.getByRole('button', { name: /code|json|\{\}/i }).first();
  }

  private get deleteRuleButton(): Locator {
    return this.page.getByRole('button', { name: /delete|trash/i }).first();
  }

  private get expandPanelButton(): Locator {
    return this.page.getByRole('button', { name: /expand|enlarge/i }).first();
  }

  // --- Rule Blocks section ---

  private get ruleBlocksHeading(): Locator {
    return this.page.getByText('Rule Blocks', { exact: true }).first();
  }

  /** IF block card (first conditional block with "IF" and "CASE 1") */
  private get ifBlock(): Locator {
    const ifLabel = this.page.getByText('IF', { exact: true }).first();
    return ifLabel.locator('..').locator('..').locator('..');
  }

  /** ELSE block card (default block with "ELSE" and "DEFAULT") */
  private get elseBlock(): Locator {
    const elseLabel = this.page.getByText('ELSE', { exact: true }).first();
    return elseLabel.locator('..').locator('..').locator('..');
  }

  private get addElseIfButton(): Locator {
    return this.page.getByRole('button', { name: /\+?\s*else if/i }).first();
  }

  private get addConditionButton(): Locator {
    return this.ifBlock.getByRole('button', { name: /\+?\s*add condition/i }).first()
      .or(this.page.getByRole('button', { name: /\+?\s*add condition/i }).first());
  }

  /** Operator dropdown in IF block (e.g. "Equals") */
  private get conditionOperatorDropdown(): Locator {
    return this.ifBlock.getByRole('combobox').filter({ hasText: /equals|contains|greater/i }).first()
      .or(this.ifBlock.locator('button').filter({ hasText: /equals/i }).first());
  }

  /** "Select field" input in IF condition row */
  private get conditionFieldInput(): Locator {
    return this.ifBlock.getByPlaceholder('Select field').first();
  }

  /** "Enter value" input in IF condition row */
  private get conditionValueInput(): Locator {
    return this.ifBlock.getByPlaceholder('Enter value').first();
  }

  /** Toggle switch inside the IF block */
  private get ifBlockToggle(): Locator {
    return this.ifBlock.getByRole('switch').first().or(this.ifBlock.getByRole('checkbox').first());
  }

  /** Toggle switch inside the ELSE block */
  private get elseBlockToggle(): Locator {
    return this.elseBlock.getByRole('switch').first().or(this.elseBlock.getByRole('checkbox').first());
  }

  // --- Footer ---

  private get ruleNodeFooter(): Locator {
    return this.page.getByText('Rule Node:', { exact: true }).first();
  }

  // --- Actions ---

  async closePanel(): Promise<void> {
    if (await this.closePanelButton.isVisible().catch(() => false)) {
      await this.closePanelButton.click();
      await expect(this.closePanelButton).toBeHidden({ timeout: 10_000 }).catch(() => {});
    } else {
      const closeX = this.page.getByRole('button', { name: /^close$/i }).first();
      if (await closeX.isVisible().catch(() => false)) await closeX.click();
      else await this.page.keyboard.press('Escape').catch(() => {});
    }
  }

  async setDescription(description: string): Promise<void> {
    await expect(this.descriptionField).toBeVisible({ timeout: 10_000 });
    await this.descriptionField.click();
    await this.descriptionField.fill(description);
    await this.page.waitForTimeout(300);
  }

  async setRuleTitle(title: string): Promise<void> {
    const titleInput = this.page.getByRole('textbox', { name: /rule name|name/i }).first()
      .or(this.page.getByPlaceholder(/rule name|name/i).first());
    if (await titleInput.isVisible().catch(() => false)) {
      await titleInput.click();
      await titleInput.fill(title);
      await this.page.waitForTimeout(300);
    }
  }

  async setIfCondition(options: { field?: string; operator?: string; value?: string }): Promise<void> {
    await expect(this.ifBlock).toBeVisible({ timeout: 10_000 });

    if (options.field !== undefined) {
      await this.conditionFieldInput.click();
      await this.conditionFieldInput.fill(options.field);
      const opt = this.page.getByRole('option').filter({ hasText: new RegExp(options.field, 'i') }).first();
      if (await opt.isVisible({ timeout: 2_000 }).catch(() => false)) await opt.click();
      await this.page.waitForTimeout(200);
    }

    if (options.operator !== undefined) {
      await this.conditionOperatorDropdown.click();
      await this.page.waitForTimeout(300);
      const operatorOpt = this.page.getByRole('option').filter({ hasText: new RegExp(options.operator, 'i') }).first();
      await expect(operatorOpt).toBeVisible({ timeout: 5_000 });
      await operatorOpt.click();
      await this.page.waitForTimeout(200);
    }

    if (options.value !== undefined) {
      await this.conditionValueInput.click();
      await this.conditionValueInput.fill(options.value);
      await this.page.waitForTimeout(200);
    }
  }

  async setIfBlockEnabled(enabled: boolean): Promise<void> {
    await expect(this.ifBlockToggle).toBeVisible({ timeout: 10_000 });
    const checked = await this.ifBlockToggle.isChecked().catch(() => false);
    if (enabled !== checked) await this.ifBlockToggle.click();
    await this.page.waitForTimeout(200);
  }

  async setElseBlockEnabled(enabled: boolean): Promise<void> {
    await expect(this.elseBlockToggle).toBeVisible({ timeout: 10_000 });
    const checked = await this.elseBlockToggle.isChecked().catch(() => false);
    if (enabled !== checked) await this.elseBlockToggle.click();
    await this.page.waitForTimeout(200);
  }

  async addCondition(): Promise<void> {
    await expect(this.addConditionButton).toBeVisible({ timeout: 10_000 });
    await this.addConditionButton.click();
    await this.page.waitForTimeout(500);
  }

  async addElseIf(): Promise<void> {
    await expect(this.addElseIfButton).toBeVisible({ timeout: 10_000 });
    await this.addElseIfButton.click();
    await this.page.waitForTimeout(500);
  }

  async clickEditRule(): Promise<void> {
    await this.editRuleButton.click();
    await this.page.waitForTimeout(300);
  }

  async clickDeleteRule(): Promise<void> {
    await this.deleteRuleButton.click();
    await this.page.waitForTimeout(300);
  }

  async clickCodeView(): Promise<void> {
    await this.codeViewButton.click();
    await this.page.waitForTimeout(300);
  }

  async expectPanelVisible(): Promise<void> {
    await expect(this.ruleBlocksHeading).toBeVisible({ timeout: 15_000 });
  }
}
