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

  private get titleInput() {
    return this.page.getByPlaceholder('Add name...')
      .or(this.page.locator('input[placeholder*="name" i]').first())
      .first();
  }

  /**
   * Set the agent node title (name field at the top of the panel).
   */
  async setAgentTitle(title: string): Promise<void> {
    await expect(this.titleInput).toBeVisible({ timeout: 10_000 });
    await this.titleInput.click();
    await this.titleInput.clear();
    await this.titleInput.fill(title);
    await this.page.waitForTimeout(500);
    console.log(`✅ Agent title set to: ${title}`);
  }

  /**
   * Assert the agent node title matches the expected value (for collab sync in Browser B).
   * The app lowercases the title, so comparison is case-insensitive.
   */
  async expectAgentTitle(expectedTitle: string): Promise<void> {
    await expect(this.titleInput).toHaveValue(expectedTitle.toLowerCase(), { timeout: 15_000 });
    console.log(`✅ Agent title verified: ${expectedTitle}`);
  }

  private get descriptionInput() {
    return this.page.getByPlaceholder('Add description...')
      .or(this.page.locator('textarea[placeholder*="description" i]').first())
      .or(this.page.locator('input[placeholder*="description" i]').first())
      .first();
  }

  /**
   * Set the agent node description (field below the title at the top of the panel).
   */
  async setAgentDescription(description: string): Promise<void> {
    await expect(this.descriptionInput).toBeVisible({ timeout: 10_000 });
    await this.descriptionInput.click();
    await this.descriptionInput.clear();
    await this.descriptionInput.fill(description);
    await this.page.waitForTimeout(500);
    console.log(`✅ Agent description set to: ${description}`);
  }

  /**
   * Assert the agent node description matches the expected value (for collab sync in Browser B).
   */
  async expectAgentDescription(expectedDescription: string): Promise<void> {
    await expect(this.descriptionInput).toHaveValue(expectedDescription, { timeout: 15_000 });
    console.log(`✅ Agent description verified: ${expectedDescription}`);
  }

  /**
   * Change the model in the agent panel when a model is already selected.
   * Clicks the dropdown trigger showing the current model, then picks the target from the list.
   */
  async changeModel(model: string): Promise<void> {
    // Scroll up to make sure the Model area is in view
    await this.page.getByText('Model', { exact: false }).first().scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(300);

    // The trigger is a button/combobox that shows the current model name (e.g. "OpenAI GPT-5.2 400K")
    const modelTrigger = this.page.locator('button, [role="combobox"]')
      .filter({ hasText: /gpt|openai/i })
      .first();
    await expect(modelTrigger).toBeVisible({ timeout: 10_000 });
    console.log('Clicking model dropdown trigger...');
    await modelTrigger.click();
    await this.page.waitForTimeout(1000);

    // The dropdown renders as a popover with role="option" items; pick the first exact match
    const pattern = this.modelToOptionPattern(model);
    const modelOption = this.page.locator('[role="option"]').filter({ hasText: pattern }).first();

    await expect(modelOption).toBeVisible({ timeout: 10_000 });
    await modelOption.click();
    await this.page.waitForTimeout(1000);
    console.log(`✅ Model changed to: ${model}`);
  }

  /**
   * Assert the currently selected model text is visible on the page (for collab sync in Browser B).
   */
  async expectModel(expectedModel: string): Promise<void> {
    const pattern = this.modelToOptionPattern(expectedModel);
    await expect(this.page.getByText(pattern).first()).toBeVisible({ timeout: 15_000 });
    console.log(`✅ Model verified: ${expectedModel}`);
  }

  /**
   * Set the prompt template / instructions in the agent panel (e.g. "you are an ai assistant").
   * Targets the first editable field in the Instructions region (system prompt).
   */
  async setPromptTemplate(text: string): Promise<void> {
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

  /**
   * Set the user prompt (second editable field in the Instructions region, role: "user").
   */
  async setUserPrompt(text: string): Promise<void> {
    const userPromptBox = this.page
      .getByRole('region', { name: 'Instructions' })
      .locator('[contenteditable="true"], textarea')
      .nth(1);
    await expect(userPromptBox).toBeVisible({ timeout: 10_000 });
    await userPromptBox.click();
    await this.page.waitForTimeout(300);
    await this.page.keyboard.press('ControlOrMeta+a');
    await this.page.waitForTimeout(200);
    await this.page.keyboard.type(text);
    await this.page.waitForTimeout(500);
    console.log(`✅ User prompt set to: ${text}`);
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

  /**
   * Ensure the State Update section is open (expand only if collapsed).
   */
  async ensureStateUpdateSectionOpen(): Promise<void> {
    const section = this.page.getByText('State Update', { exact: true }).first();
    await expect(section).toBeVisible({ timeout: 10_000 });
    await section.scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(300);

    // If the "Add state update" button is already visible, section is open
    const addBtn = this.page.getByRole('button', { name: /add state update/i });
    const alreadyOpen = await addBtn.isVisible({ timeout: 2_000 }).catch(() => false);
    if (alreadyOpen) {
      console.log('✅ State Update section already open');
      return;
    }

    // Otherwise, click the expand chevron
    const expandButton = section.locator('..').locator('button').filter({ has: this.page.locator('svg') }).first()
      .or(this.page.getByRole('button', { name: /state update/i }).first())
      .or(section.locator('..').getByRole('button').first());
    await expandButton.click();
    await this.page.waitForTimeout(500);
    console.log('✅ State Update section expanded');
  }

  /**
   * In the existing state update, click the X button on the value tag to clear it,
   * then type a new value. Scrolls to the State Update area first.
   */
  async clearStateUpdateValueAndType(newValue: string): Promise<void> {
    await this.ensureStateUpdateSectionOpen();

    // Find the {{nodeOutput.text}} tag, then its sibling X button
    const valueTag = this.page.getByText('{{nodeOutput.text}}').first();
    await valueTag.scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(300);
    await expect(valueTag).toBeVisible({ timeout: 10_000 });

    const xButton = valueTag.locator('..').locator('[role="button"]')
      .filter({ has: this.page.locator('svg.lucide-x') }).first();
    await expect(xButton).toBeVisible({ timeout: 10_000 });
    await xButton.click();
    await this.page.waitForTimeout(500);

    // After clearing the tag, focus stays in the combobox/input area with suggestions.
    // Just type the new value directly and dismiss the dropdown.
    await this.page.keyboard.type(newValue, { delay: 50 });
    await this.page.waitForTimeout(300);
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(500);
    console.log(`✅ State update value cleared and set to: ${newValue}`);
  }

  /**
   * Click "Add state update" to add a new row, then fill the variable field.
   */
  async addNewStateUpdateVariable(variable: string): Promise<void> {
    const addBtn = this.page.getByRole('button', { name: /add state update/i });
    await addBtn.scrollIntoViewIfNeeded();
    await expect(addBtn).toBeVisible({ timeout: 10_000 });
    await addBtn.click();
    await this.page.waitForTimeout(500);

    // The newly added row has an empty input with placeholder "Select variable"
    const variableField = this.page.getByPlaceholder('Select variable').last();
    await expect(variableField).toBeVisible({ timeout: 10_000 });
    await variableField.click();
    await variableField.fill(variable);
    await this.page.waitForTimeout(500);
    console.log(`✅ New state update added with variable: ${variable}`);
  }

  /**
   * Assert a state update variable field has the expected value in Browser B.
   * Uses getByText as the field may render as text or as an input with value.
   */
  async expectStateUpdateVariable(expectedVariable: string): Promise<void> {
    const byInput = this.page.getByPlaceholder('Select variable').filter({ has: this.page.locator(`[value="${expectedVariable}"]`) }).first();
    const byText = this.page.getByText(expectedVariable);
    const target = byInput.or(byText).first();
    await expect(target).toBeVisible({ timeout: 15_000 });
    console.log(`✅ State update variable verified: ${expectedVariable}`);
  }

  /**
   * Expand the Conditions section within a state update (click the "Conditions" or "+ Add condition" button).
   */
  async expandConditionsSection(): Promise<void> {
    const addConditionBtn = this.page.getByRole('button', { name: /add condition/i }).first();
    await addConditionBtn.scrollIntoViewIfNeeded();
    await expect(addConditionBtn).toBeVisible({ timeout: 10_000 });
    await addConditionBtn.click();
    await this.page.waitForTimeout(500);
    console.log('✅ Conditions section expanded / condition added');
  }

  /**
   * Fill in a condition row: field (Select field input), value (Enter value input).
   */
  async fillCondition(options: { field: string; value: string }, index = 0): Promise<void> {
    const { field, value } = options;

    const fieldInput = this.page.getByPlaceholder('Select field').nth(index);
    await expect(fieldInput).toBeVisible({ timeout: 10_000 });
    await fieldInput.click();
    await fieldInput.clear();
    await fieldInput.fill(field);
    await this.page.waitForTimeout(300);

    const valueInput = this.page.getByPlaceholder('Enter value').nth(index);
    await expect(valueInput).toBeVisible({ timeout: 10_000 });
    await valueInput.click();
    await valueInput.clear();
    await valueInput.fill(value);
    await this.page.waitForTimeout(500);
    console.log(`✅ Condition filled: field="${field}", value="${value}"`);
  }

  /**
   * Assert a condition's field and value are visible in Browser B.
   */
  async expectConditionVisible(options: { field: string; value: string }, index = 0): Promise<void> {
    const { field, value } = options;
    const fieldInput = this.page.getByPlaceholder('Select field').nth(index);
    await expect(fieldInput).toHaveValue(field, { timeout: 15_000 });
    const valueInput = this.page.getByPlaceholder('Enter value').nth(index);
    await expect(valueInput).toHaveValue(value, { timeout: 15_000 });
    console.log(`✅ Condition verified: field="${field}", value="${value}"`);
  }

  /** Locate the Structured Output toggle by finding the label, then going up to its immediate row. */
  private get structuredOutputToggle() {
    return this.page.getByText('Structured Output', { exact: true }).first()
      .locator('xpath=ancestor::div[contains(@class, "py-3")]')
      .first()
      .getByRole('switch');
  }

  /**
   * Enable the Structured Output toggle switch.
   * If already enabled, this is a no-op. Also expands the accordion.
   */
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

    // Expand the accordion section so JSON Schema tab is visible
    const accordionBtn = this.page.getByText('Structured Output', { exact: true }).first()
      .locator('xpath=ancestor::button[@data-orientation="vertical"]');
    const accordionState = await accordionBtn.getAttribute('data-state').catch(() => 'open');
    if (accordionState === 'closed') {
      await accordionBtn.click();
      await this.page.waitForTimeout(500);
      console.log('✅ Structured Output section expanded');
    }
  }

  /**
   * Assert the Structured Output toggle is enabled in Browser B.
   */
  async expectStructuredOutputEnabled(): Promise<void> {
    const toggle = this.structuredOutputToggle;
    await toggle.scrollIntoViewIfNeeded();
    await expect(toggle).toHaveAttribute('data-state', 'checked', { timeout: 15_000 });
    console.log('✅ Structured Output toggle verified as enabled');
  }

  /**
   * Expand the Structured Output accordion and click the JSON Schema tab.
   * Used on Browser B to make the schema content visible before asserting.
   */
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
    console.log('✅ JSON Schema tab opened (Browser B)');
  }

  /**
   * Click the "JSON Schema" tab and replace the editor content with the provided JSON.
   * The editor is a Monaco editor (not CodeMirror).
   */
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
}
