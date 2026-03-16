import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';

export class ScriptNodePanel {
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
    console.log(`✅ Script title set to: ${title}`);
  }

  async expectTitle(expectedTitle: string): Promise<void> {
    await expect(this.titleInput).toHaveValue(expectedTitle.toLowerCase(), { timeout: 15_000 });
    console.log(`✅ Script title verified: ${expectedTitle}`);
  }

  // ─── Description ───

  async setDescription(description: string): Promise<void> {
    await expect(this.descriptionInput).toBeVisible({ timeout: 10_000 });
    await this.descriptionInput.click();
    await this.descriptionInput.clear();
    await this.descriptionInput.fill(description);
    await this.page.waitForTimeout(500);
    console.log(`✅ Script description set to: ${description}`);
  }

  async expectDescription(expectedDescription: string): Promise<void> {
    await expect(this.descriptionInput).toHaveValue(expectedDescription, { timeout: 15_000 });
    console.log(`✅ Script description verified: ${expectedDescription}`);
  }

  // ─── Input Params ───

  /**
   * Click "Edit params" to open the input params editor, then modify a param value.
   * For a fresh script node the default param is "score" with value 95.
   */
  async editInputParamValue(paramName: string, newValue: string): Promise<void> {
    const editParamsBtn = this.page.getByRole('button', { name: /edit params/i });
    await editParamsBtn.scrollIntoViewIfNeeded();
    await expect(editParamsBtn).toBeVisible({ timeout: 10_000 });
    await editParamsBtn.click();
    await this.page.waitForTimeout(500);

    // Find the input field for the given param — look for an input near the param name label
    const paramInput = this.page.locator('input').filter({ has: this.page.locator(`[value="${paramName}"]`) }).first()
      .or(this.page.getByLabel(paramName, { exact: false }).first())
      .or(this.page.locator(`input[value]`).last());

    const paramVisible = await paramInput.isVisible({ timeout: 3_000 }).catch(() => false);
    if (paramVisible) {
      await paramInput.click();
      await paramInput.clear();
      await paramInput.fill(newValue);
    } else {
      // Fallback: find the value input next to the param name text
      const valueInput = this.page.getByText(paramName, { exact: true }).locator('..').locator('..').locator('input').first();
      await expect(valueInput).toBeVisible({ timeout: 10_000 });
      await valueInput.click();
      await valueInput.clear();
      await valueInput.fill(newValue);
    }
    await this.page.waitForTimeout(500);
    console.log(`✅ Input param "${paramName}" value set to: ${newValue}`);
  }

  // ─── Code Editor (Monaco) ───

  /**
   * Replace the code in the Monaco editor with new content.
   * The Code section has a Monaco editor with existing JavaScript.
   */
  async setCode(code: string): Promise<void> {
    const codeLabel = this.page.getByText('Code', { exact: true }).first();
    await codeLabel.scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(300);

    const monacoEditor = this.page.locator('.monaco-editor').first();
    await expect(monacoEditor).toBeVisible({ timeout: 10_000 });
    await monacoEditor.click();
    await this.page.waitForTimeout(300);

    await this.page.keyboard.press('ControlOrMeta+a');
    await this.page.waitForTimeout(200);
    await this.page.keyboard.press('Backspace');
    await this.page.waitForTimeout(300);

    await this.page.keyboard.insertText(code);
    await this.page.waitForTimeout(500);
    console.log('✅ Code editor content set');
  }

  /**
   * Assert that certain text appears in the code editor area on Browser B.
   */
  async expectCodeContains(text: string): Promise<void> {
    const codeLabel = this.page.getByText('Code', { exact: true }).first();
    await codeLabel.scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(300);

    await expect(this.page.locator('.monaco-editor').first()).toBeVisible({ timeout: 10_000 });
    await expect(this.page.getByText(text).first()).toBeVisible({ timeout: 15_000 });
    console.log(`✅ Code editor contains: "${text}"`);
  }

  // ─── Output JSON Schema ───

  /**
   * Open the output section and replace the JSON schema content in the Monaco editor.
   * The output schema editor is typically below the code section.
   */
  async setOutputSchema(jsonContent: string): Promise<void> {
    // Scroll down to find the output schema area
    const outputLabel = this.page.getByText('Output', { exact: false })
      .filter({ hasText: /output/i }).first();
    await outputLabel.scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(300);

    // The JSON Schema tab for output (if tabs exist)
    const jsonTab = this.page.getByRole('tab', { name: /json schema/i });
    const hasJsonTab = await jsonTab.isVisible({ timeout: 2_000 }).catch(() => false);
    if (hasJsonTab) {
      await jsonTab.click();
      await this.page.waitForTimeout(500);
    }

    // Target the last Monaco editor on the page (output schema is below code editor)
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
    console.log('✅ Output JSON Schema content set');
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

  /**
   * Click "Add State" to add a new state update row, then fill variable and value.
   * For script nodes, state update starts empty.
   */
  async addStateUpdate(variable: string, value: string): Promise<void> {
    await this.ensureStateUpdateSectionOpen();

    const addBtn = this.page.getByRole('button', { name: /add state/i });
    await addBtn.scrollIntoViewIfNeeded();
    await expect(addBtn).toBeVisible({ timeout: 10_000 });
    await addBtn.click();
    await this.page.waitForTimeout(500);

    // Fill the variable field (newly added row has placeholder "Select variable")
    const variableField = this.page.getByPlaceholder('Select variable').last();
    await expect(variableField).toBeVisible({ timeout: 10_000 });
    await variableField.click();
    await variableField.fill(variable);
    await this.page.waitForTimeout(300);
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(300);

    // Fill the value — after adding a state update, there should be a value combobox/input
    // The value area is typically a combobox; click it and type
    const valueArea = this.page.getByPlaceholder('Enter value')
      .or(this.page.getByPlaceholder('Select value'))
      .or(this.page.getByPlaceholder('Value'))
      .last();
    const valueVisible = await valueArea.isVisible({ timeout: 3_000 }).catch(() => false);
    if (valueVisible) {
      await valueArea.click();
      await valueArea.fill(value);
    } else {
      // Fallback: click the value combobox and type
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
    console.log('Closing Script configuration panel...');
    if (await this.closePanelButton.isVisible().catch(() => false)) {
      await this.closePanelButton.click();
    } else {
      await this.page.keyboard.press('Escape').catch(() => {});
    }
    await this.page.waitForTimeout(800);
    console.log('✅ Script panel closed');
  }
}
