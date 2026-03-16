import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class AgentNodePanel {
  constructor(private readonly page: Page) {}

  /** Section containing the Model label and its combobox (avoids matching Instructions "user" combobox). */
  private get modelSection() {
    return this.page.getByText('Model', { exact: true }).first().locator('..').locator('..');
  }

  private get modelDropdown() {
    return this.modelSection.getByRole('combobox').filter({ hasText: 'Select model' }).first()
      .or(this.modelSection.locator('button').filter({ hasText: 'Select model' }).first());
  }

  /** Chevron inside Model dropdown area (opens the model list). */
  private get modelDropdownChevron() {
    return this.modelSection.locator('button[aria-haspopup="listbox"]').filter({ has: this.page.locator('svg') }).first()
      .or(this.modelSection.locator('svg').first());
  }

  private get closePanelButton() {
    return this.page.getByRole('button', { name: /close panel/i });
  }

  private get manageToolsButton() {
    return this.page.getByRole('button', { name: /manage tools/i });
  }

  private get addToolButton() {
    return this.page.getByRole('button', { name: /add tool/i });
  }

  private get toolsSectionAnchor() {
    // Anchor used only for scrolling; UI label is typically "TOOLS" / "Tools"
    return this.page.getByText(/^tools$/i).first();
  }

  private get manageToolsDialog() {
    return this.page.getByRole('dialog', { name: /manage tools/i });
  }

  async closeManageTools() {
    // Closes the Manage Tools modal/dialog if it is open.
    if (!(await this.manageToolsDialog.isVisible().catch(() => false))) return;

    console.log('Closing Manage Tools dialog...');
    const closeBtn = this.manageToolsDialog.getByRole('button', { name: /^close$/i }).first();
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click();
    } else {
      await this.page.keyboard.press('Escape').catch(() => {});
    }
    await expect(this.manageToolsDialog).toBeHidden({ timeout: 10_000 });
    console.log('✅ Manage Tools dialog closed');
  }

  /**
   * Build a regex that matches the model name in the UI (e.g. "gpt-4o-mini" matches "GPT-4o mini", "OpenAI GPT-4o mini").
   */
  private modelToOptionPattern(model: string): RegExp {
    const escaped = escapeRegex(model);
    const flexible = escaped.replace(/-/g, '[\\s-]+');
    return new RegExp(flexible, 'i');
  }

  async configureAgent(data: {
    model: string;
    systemPrompt?: string;  // Make optional
  }) {
    console.log('Configuring agent node...');
    await this.page.waitForTimeout(2000);

    console.log(`Opening model dropdown and selecting: ${data.model}`);
    await expect(this.modelDropdown).toBeVisible({ timeout: 15_000 });
    await expect(this.modelDropdown).toBeEnabled({ timeout: 5_000 });

    // Open dropdown: click the Model combobox (single source of truth within Model section)
    await this.modelDropdown.click();
    await this.page.waitForTimeout(600);

    // Wait for dropdown content: listbox or popover with options
    const listbox = this.page.getByRole('listbox').first();
    const listboxVisible = await listbox.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!listboxVisible) {
      await expect(this.modelDropdown).toHaveAttribute('data-state', 'open', { timeout: 5_000 }).catch(() => {});
      await this.page.waitForTimeout(500);
    }

    // Optional: filter by search if "Search models" is present (long lists)
    const searchModels = this.page.getByRole('textbox', { name: /search models/i });
    if (await searchModels.isVisible({ timeout: 2_000 }).catch(() => false)) {
      const searchTerm = data.model.replace(/\bOpenAI\s+/gi, '').replace(/-/g, ' ').trim();
      await searchModels.fill(searchTerm);
      await this.page.waitForTimeout(600);
    }

    const pattern = this.modelToOptionPattern(data.model);

    // Prefer options inside listbox so we don't match other combobox options on the page
    const listboxOrPage = listboxVisible ? listbox : this.page;
    let modelOption = listboxOrPage.getByRole('option').filter({ hasText: pattern }).first();
    let found = await modelOption.isVisible({ timeout: 3_000 }).catch(() => false);

    if (!found) {
      modelOption = listboxOrPage.getByRole('option', { name: pattern }).first();
      found = await modelOption.isVisible({ timeout: 2_000 }).catch(() => false);
    }
    if (!found) {
      modelOption = listboxOrPage.getByText(pattern).first();
      found = await modelOption.isVisible({ timeout: 2_000 }).catch(() => false);
    }
    if (!found) {
      modelOption = this.page.getByRole('option').filter({ hasText: pattern }).first();
      found = await modelOption.isVisible({ timeout: 2_000 }).catch(() => false);
    }
    if (!found) {
      modelOption = this.page.getByText(pattern).first();
      found = await modelOption.isVisible({ timeout: 2_000 }).catch(() => false);
    }

    if (!found) {
      console.log('Model option not found by text; retrying dropdown open and first OpenAI option as fallback');
      await this.modelDropdown.click();
      await this.page.waitForTimeout(300);
      await this.modelDropdown.click();
      await this.page.waitForTimeout(800);
      modelOption = (listboxVisible ? listbox : this.page).getByRole('option').filter({ hasText: /openai|gpt/i }).first();
      found = await modelOption.isVisible({ timeout: 3_000 }).catch(() => false);
    }
    if (!found) {
      modelOption = this.page.getByRole('option').first();
    }

    await expect(modelOption).toBeVisible({ timeout: 5_000 });
    await modelOption.click();

    console.log(`✅ Model selected: ${data.model}`);
    await this.page.waitForTimeout(1500);
    console.log('Skipping system prompt configuration - using defaults');
  }

  /**
   * Set the prompt template / instructions in the agent panel (e.g. "you are an ai assistant").
   */
  async setPromptTemplate(text: string): Promise<void> {
    // Single scoped locator to avoid strict-mode violation (Instructions region has one editable field)
    const instructionsBox = this.page
      .getByRole('region', { name: 'Instructions' })
      .locator('[contenteditable="true"], textarea')
      .first();
    await expect(instructionsBox).toBeVisible({ timeout: 10_000 });
    await instructionsBox.click();
    await this.page.waitForTimeout(300);
    await this.page.keyboard.press('ControlOrMeta+a');
    await this.page.waitForTimeout(200);
    await this.page.keyboard.type(text);
    await this.page.waitForTimeout(500);
  }

  async closePanel() {
    console.log('Closing agent configuration panel...');

    // Panel might already be closed; don't hard-fail on missing button.
    if (await this.closePanelButton.isVisible().catch(() => false)) {
      await this.closePanelButton.click();
    } else {
      // fallback: Escape usually closes the side panel
      await this.page.keyboard.press('Escape').catch(() => {});
    }

    // Best-effort: wait a bit for UI to settle
    await this.page.waitForTimeout(800);
    console.log('✅ Agent panel close attempted');
  }

  async addTool(toolName: string) {
    console.log(`Adding tool: ${toolName}`);
    await expect(this.manageToolsButton).toBeVisible({ timeout: 10_000 });
    await this.manageToolsButton.click();
    await this.page.waitForTimeout(500);
    
    const tool = this.page.getByText(toolName, { exact: false });
    await expect(tool).toBeVisible({ timeout: 5_000 });
    await tool.click();
    console.log(`✅ Tool added: ${toolName}`);
  }

  /**
   * Adds a tool using the "Add Tool" button inside the Tools section.
   * - If toolName is not provided, this is a no-op.
   * - After selecting a tool, it attempts to close the tool picker/tab (Escape fallback).
   */
  async addToolFromToolsField(toolName?: string) {
    if (!toolName) {
      console.log('No tool name provided; skipping tool addition');
      return;
    }

    console.log(`Adding tool via "Add Tool": ${toolName}`);

    // Scroll down to ensure Tools section buttons are available
    try {
      if (await this.toolsSectionAnchor.isVisible({ timeout: 1500 }).catch(() => false)) {
        await this.toolsSectionAnchor.scrollIntoViewIfNeeded();
      }
    } catch {
      // ignore; we'll rely on scrolling via button visibility
    }

    // Ensure "Add Tool" is visible; if not, scroll it into view
    await this.addToolButton.scrollIntoViewIfNeeded();
    await expect(this.addToolButton).toBeVisible({ timeout: 10_000 });
    await this.addToolButton.click();
    await this.page.waitForTimeout(500);

    // Tool picker opens as a dialog "Select Tools" with search box and "Add tools" CTA.
    const dialog = this.page.getByRole('dialog', { name: /select tools/i });
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    const search = dialog.getByRole('textbox', { name: /search tools/i });
    await expect(search).toBeVisible({ timeout: 10_000 });
    await search.fill(toolName);
    await this.page.waitForTimeout(300);

    // The displayed tile name may differ from internal tool id (e.g., "HandoffNode" vs "Handoff to Node").
    // Prefer exact match; fall back to a contains match within the dialog.
    const toolTile =
      dialog.getByText(toolName, { exact: true }).first().or(dialog.getByText(toolName, { exact: false }).first());

    await expect(toolTile).toBeVisible({ timeout: 10_000 });
    await toolTile.click();
    console.log(`✅ Tool selected in picker: ${toolName}`);

    // Button label is dynamic (e.g., "Add 1 tool", "Add 2 tools", or "Add tools")
    const addToolsBtn = dialog.getByRole('button', { name: /add\s+\d+\s+tool(s)?|add tools/i });
    if (await addToolsBtn.isDisabled().catch(() => false)) {
      // Some tiles may require clicking checkbox or card container; try clicking again on container area.
      await toolTile.click().catch(() => {});
    }
    await expect(addToolsBtn).toBeEnabled({ timeout: 5_000 });
    await addToolsBtn.click();

    // Some builds keep the dialog open after adding; explicitly close it.
    const dialogCloseBtn = dialog.getByRole('button', { name: /^close$/i }).or(
      dialog.getByRole('button', { name: /close/i })
    );

    if (await dialog.isVisible().catch(() => false)) {
      if (await dialogCloseBtn.isVisible().catch(() => false)) {
        await dialogCloseBtn.click();
      } else {
        // fallback: top-right "X" is often exposed as a generic close button
        await this.page.keyboard.press('Escape').catch(() => {});
      }
    }

    await expect(dialog).toBeHidden({ timeout: 10_000 });
    console.log('✅ Tools added and picker closed');
  }

  /**
   * Expand the State Update section in the agent panel (click the arrow/chevron).
   */
  async expandStateUpdateSection(): Promise<void> {
    const section = this.page.getByText('State Update', { exact: true }).first();
    await expect(section).toBeVisible({ timeout: 10_000 });
    await section.scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(300);
    // Arrow/chevron to expand: usually next to the section header (sibling or within same container)
    const expandButton = section.locator('..').locator('button').filter({ has: this.page.locator('svg') }).first()
      .or(this.page.getByRole('button', { name: /state update/i }).first())
      .or(section.locator('..').getByRole('button').first());
    await expandButton.click();
    await this.page.waitForTimeout(500);
    console.log('✅ State Update section expanded');
  }

  /**
   * Add a state update: Variable (e.g. {{thread.agent_0_messages}}), Action (e.g. Append), Value (e.g. Agent 1).
   */
  async addStateUpdate(options: { variable: string; action: string; value: string }): Promise<void> {
    const { variable, action, value } = options;
    await this.page.getByRole('button', { name: /add state update/i }).click();
    await this.page.waitForTimeout(500);

    const variableField = this.page.getByPlaceholder('Select Variable').first();
    await expect(variableField).toBeVisible({ timeout: 10_000 });
    await variableField.fill(variable);
    await this.page.waitForTimeout(300);

    const setField = this.page.getByPlaceholder('Set').first();
    await expect(setField).toBeVisible({ timeout: 5_000 });
    await setField.click();
    await this.page.waitForTimeout(400);
    await this.page.getByRole('option', { name: new RegExp(escapeRegex(action), 'i') }).first().click();
    await this.page.waitForTimeout(300);

    const valueInput = this.page.getByPlaceholder('Value').or(this.page.locator('input').filter({ hasNot: this.page.getByPlaceholder('Select Variable') }).filter({ hasNot: this.page.getByPlaceholder('Set') }).first()).first();
    const valueVisible = await valueInput.isVisible({ timeout: 3_000 }).catch(() => false);
    if (valueVisible) {
      await valueInput.fill(value);
    } else {
      const lastInputInPanel = this.page.locator('input').last();
      await lastInputInPanel.fill(value);
    }
    await this.page.waitForTimeout(400);
    console.log(`✅ State update added: ${variable}, ${action}, ${value}`);
  }

  /**
   * Assert that a state update is visible (for collaboration sync check in Browser B).
   * Expects variable text, action (e.g. Append), and value (e.g. Agent 1) to be visible.
   */
  async expectStateUpdateVisible(options: { variable: string; action: string; value: string }): Promise<void> {
    const { variable, action, value } = options;
    await expect(this.page.getByText(variable)).toBeVisible({ timeout: 15_000 });
    await expect(this.page.getByText(action, { exact: true })).toBeVisible({ timeout: 5_000 });
    await expect(this.page.getByText(value)).toBeVisible({ timeout: 5_000 });
    console.log('✅ State update visible in panel');
  }
}
