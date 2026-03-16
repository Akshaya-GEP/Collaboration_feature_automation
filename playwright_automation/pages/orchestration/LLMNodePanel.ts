import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class LLMNodePanel {
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

  private modelToOptionPattern(model: string): RegExp {
    const escaped = escapeRegex(model);
    const flexible = escaped.replace(/-/g, '[\\s-]+');
    return new RegExp(flexible, 'i');
  }

  // ─── Title ───

  async setTitle(title: string): Promise<void> {
    await expect(this.titleInput).toBeVisible({ timeout: 10_000 });
    await this.titleInput.click();
    await this.titleInput.clear();
    await this.titleInput.fill(title);
    await this.page.waitForTimeout(500);
    console.log(`✅ LLM title set to: ${title}`);
  }

  async expectTitle(expectedTitle: string): Promise<void> {
    await expect(this.titleInput).toHaveValue(expectedTitle.toLowerCase(), { timeout: 15_000 });
    console.log(`✅ LLM title verified: ${expectedTitle}`);
  }

  // ─── Description ───

  async setDescription(description: string): Promise<void> {
    await expect(this.descriptionInput).toBeVisible({ timeout: 10_000 });
    await this.descriptionInput.click();
    await this.descriptionInput.clear();
    await this.descriptionInput.fill(description);
    await this.page.waitForTimeout(500);
    console.log(`✅ LLM description set to: ${description}`);
  }

  async expectDescription(expectedDescription: string): Promise<void> {
    await expect(this.descriptionInput).toHaveValue(expectedDescription, { timeout: 15_000 });
    console.log(`✅ LLM description verified: ${expectedDescription}`);
  }

  // ─── Model ───

  async selectModel(model: string): Promise<void> {
    await this.page.getByText('Model', { exact: false }).first().scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(300);

    const modelTrigger = this.page.locator('button, [role="combobox"]')
      .filter({ hasText: /select model|gpt|openai/i })
      .first();
    await expect(modelTrigger).toBeVisible({ timeout: 10_000 });
    console.log('Clicking model dropdown trigger...');
    await modelTrigger.click();
    await this.page.waitForTimeout(1000);

    const pattern = this.modelToOptionPattern(model);
    const modelOption = this.page.locator('[role="option"]').filter({ hasText: pattern }).first();
    await expect(modelOption).toBeVisible({ timeout: 10_000 });
    await modelOption.click();
    await this.page.waitForTimeout(1000);
    console.log(`✅ Model selected: ${model}`);
  }

  async expectModel(expectedModel: string): Promise<void> {
    const pattern = this.modelToOptionPattern(expectedModel);
    await expect(this.page.getByText(pattern).first()).toBeVisible({ timeout: 15_000 });
    console.log(`✅ Model verified: ${expectedModel}`);
  }

  // ─── Prompt Template (system prompt — first editable field) ───

  async setSystemPrompt(text: string): Promise<void> {
    const promptBox = this.page
      .getByRole('region', { name: /prompt template/i })
      .locator('[contenteditable="true"], textarea')
      .first()
      .or(
        this.page.getByText('Prompt Template', { exact: false }).first()
          .locator('xpath=following::*[@contenteditable="true" or self::textarea]')
      )
      .first();
    await expect(promptBox).toBeVisible({ timeout: 10_000 });
    await promptBox.click();
    await this.page.waitForTimeout(300);
    await this.page.keyboard.press('ControlOrMeta+a');
    await this.page.waitForTimeout(200);
    await this.page.keyboard.type(text);
    await this.page.waitForTimeout(500);
    console.log(`✅ System prompt set to: ${text}`);
  }

  // ─── User Prompt (second editable field in Prompt Template) ───

  async setUserPrompt(text: string): Promise<void> {
    const userPromptBox = this.page
      .getByRole('region', { name: /prompt template/i })
      .locator('[contenteditable="true"], textarea')
      .nth(1)
      .or(
        this.page.getByText('Prompt Template', { exact: false }).first()
          .locator('xpath=following::*[@contenteditable="true" or self::textarea][2]')
      )
      .first();
    await expect(userPromptBox).toBeVisible({ timeout: 10_000 });
    await userPromptBox.click();
    await this.page.waitForTimeout(300);
    await this.page.keyboard.press('ControlOrMeta+a');
    await this.page.waitForTimeout(200);
    await this.page.keyboard.type(text);
    await this.page.waitForTimeout(500);
    console.log(`✅ User prompt set to: ${text}`);
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

  async clearStateUpdateValueAndType(newValue: string): Promise<void> {
    await this.ensureStateUpdateSectionOpen();

    const valueTag = this.page.getByText('{{nodeOutput.text}}').first();
    await valueTag.scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(300);
    await expect(valueTag).toBeVisible({ timeout: 10_000 });

    const xButton = valueTag.locator('..').locator('[role="button"]')
      .filter({ has: this.page.locator('svg.lucide-x') }).first();
    await expect(xButton).toBeVisible({ timeout: 10_000 });
    await xButton.click();
    await this.page.waitForTimeout(500);

    await this.page.keyboard.type(newValue, { delay: 50 });
    await this.page.waitForTimeout(300);
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(500);
    console.log(`✅ State update value cleared and set to: ${newValue}`);
  }

  // ─── Structured Output ───

  private get structuredOutputToggle() {
    return this.page.getByText('Structured Output', { exact: true }).first()
      .locator('xpath=ancestor::div[contains(@class, "py-3")]')
      .first()
      .getByRole('switch');
  }

  async enableStructuredOutput(): Promise<void> {
    const toggle = this.structuredOutputToggle;
    await toggle.scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(300);
    await expect(toggle).toBeVisible({ timeout: 10_000 });

    const state = await toggle.getAttribute('data-state');
    if (state !== 'checked') {
      await toggle.click();
      await this.page.waitForTimeout(500);
      console.log('✅ Structured Output enabled');
    } else {
      console.log('✅ Structured Output already enabled');
    }

    const accordionBtn = this.page.getByText('Structured Output', { exact: true }).first()
      .locator('xpath=ancestor::button[@data-orientation="vertical"]');
    const accordionState = await accordionBtn.getAttribute('data-state').catch(() => 'open');
    if (accordionState === 'closed') {
      await accordionBtn.click();
      await this.page.waitForTimeout(500);
      console.log('✅ Structured Output section expanded');
    }
  }

  async expectStructuredOutputEnabled(): Promise<void> {
    const toggle = this.structuredOutputToggle;
    await toggle.scrollIntoViewIfNeeded();
    await expect(toggle).toHaveAttribute('data-state', 'checked', { timeout: 15_000 });
    console.log('✅ Structured Output toggle verified as enabled');
  }

  async openJsonSchemaTab(): Promise<void> {
    const accordionBtn = this.page.getByText('Structured Output', { exact: true }).first()
      .locator('xpath=ancestor::button[@data-orientation="vertical"]');
    const accordionState = await accordionBtn.getAttribute('data-state').catch(() => 'open');
    if (accordionState === 'closed') {
      await accordionBtn.click();
      await this.page.waitForTimeout(500);
      console.log('✅ Structured Output section expanded (Browser B)');
    }

    const jsonTab = this.page.getByRole('tab', { name: /json schema/i });
    await jsonTab.scrollIntoViewIfNeeded();
    await expect(jsonTab).toBeVisible({ timeout: 10_000 });
    await jsonTab.click();
    await this.page.waitForTimeout(500);
    console.log('✅ JSON Schema tab opened');
  }

  async setJsonSchema(jsonContent: string): Promise<void> {
    const jsonTab = this.page.getByRole('tab', { name: /json schema/i });
    await jsonTab.scrollIntoViewIfNeeded();
    await expect(jsonTab).toBeVisible({ timeout: 10_000 });
    await jsonTab.click();
    await this.page.waitForTimeout(500);

    const monacoEditor = this.page.locator('.monaco-editor').last();
    await expect(monacoEditor).toBeVisible({ timeout: 10_000 });
    await monacoEditor.click();
    await this.page.waitForTimeout(300);

    await this.page.keyboard.press('ControlOrMeta+a');
    await this.page.waitForTimeout(200);
    await this.page.keyboard.press('Backspace');
    await this.page.waitForTimeout(300);

    await this.page.keyboard.insertText(jsonContent);
    await this.page.waitForTimeout(500);
    console.log('✅ JSON Schema content set');
  }

  // ─── Panel ───

  async closePanel() {
    console.log('Closing LLM configuration panel...');
    if (await this.closePanelButton.isVisible().catch(() => false)) {
      await this.closePanelButton.click();
    } else {
      await this.page.keyboard.press('Escape').catch(() => {});
    }
    await this.page.waitForTimeout(800);
    console.log('✅ LLM panel closed');
  }
}
