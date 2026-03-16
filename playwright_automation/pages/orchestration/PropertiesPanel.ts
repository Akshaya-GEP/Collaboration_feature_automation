import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';


export class PropertiesPanel {
  constructor(private readonly page: Page) {}


  private get propertiesPanel() {
    return this.page.getByRole('region', { name: /properties/i })
      .or(this.page.locator('[class*="panel"]').filter({ hasText: /properties|define basic/i }).first());
  }

  private get nameInput() {
    // id="agent-name", placeholder="Name of the orchestration"
    return this.page.locator('#agent-name')
      .or(this.page.getByPlaceholder('Name of the orchestration'))
      .or(this.page.getByPlaceholder('Untitled'))
      .or(this.page.getByRole('textbox', { name: /name\*|^name$/i }));
  }

  private get descriptionInput() {
    // id="description", placeholder="Short summary of what this orchestration does"
    return this.page.locator('#description')
      .or(this.page.getByPlaceholder('Short summary of what this orchestration does'))
      .or(this.page.locator('textarea[placeholder*="Short summary"]'))
      .or(this.page.getByPlaceholder(/short summary/i))
      .or(this.page.getByRole('textbox', { name: /description\*|^description$/i }))
      .or(this.page.locator('textarea').first());
  }


  private get activityCodesInput() {
    return this.page.getByPlaceholder(/search and select activities|search activities/i)
      .or(this.page.getByRole('textbox', { name: /search and select activities|search activities/i }));
  }


  /**
   * Waits for the properties panel to fully load (name + description fields ready)
   */
  async waitForPanelReady() {
    console.log('Waiting for Properties panel to load...');
    const name = this.nameInput.first();
    const desc = this.descriptionInput.first();
    await expect(name).toBeVisible({ timeout: 15_000 });
    await this.page.waitForTimeout(300);
    await expect(desc).toBeVisible({ timeout: 10_000 });
    await this.page.waitForTimeout(500); // Allow panel to settle
    console.log('✅ Properties panel loaded and ready');
  }


  /**
   * Selects an activity code from the dropdown (Access Rights).
   * activityCode: display name (e.g. "Home") or id (e.g. "10100002").
   * activityId: optional id when display name is used (e.g. Home has id 10100002).
   */
  async selectActivityCode(activityCode: string, activityId?: string) {
    console.log(`Selecting activity code: ${activityCode}${activityId ? ` (id: ${activityId})` : ''}`);

    await this.activityCodesInput.click();
    await this.activityCodesInput.clear();
    await this.activityCodesInput.fill(activityCode);
    await this.page.waitForTimeout(2000);

    const nameRe = new RegExp(`^${this.escapeRegex(activityCode)}$`, 'i');
    const idRe = activityId ? new RegExp(this.escapeRegex(activityId)) : null;
    const matchRe = idRe && activityId ? new RegExp(`${this.escapeRegex(activityCode)}|${this.escapeRegex(activityId)}`, 'i') : nameRe;

    const optionCheckbox = this.page.getByRole('checkbox', { name: matchRe }).first();
    const optionRole = this.page.getByRole('option', { name: matchRe }).first();
    const optionText = this.page.getByText(matchRe).first();

    const tryClick = async () => {
      if (await optionCheckbox.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await optionCheckbox.click();
        await expect(optionCheckbox).toBeChecked({ timeout: 2_000 });
        return true;
      }
      if (await optionRole.isVisible({ timeout: 1_500 }).catch(() => false)) {
        await optionRole.click();
        return true;
      }
      if (await optionText.isVisible({ timeout: 1_500 }).catch(() => false)) {
        await optionText.click();
        return true;
      }
      return false;
    };

    if (await tryClick()) {
      /* done */
    } else if (activityId) {
      await this.activityCodesInput.clear();
      await this.activityCodesInput.fill(activityId);
      await this.page.waitForTimeout(2000);
      const byIdCheckbox = this.page.getByRole('checkbox', { name: new RegExp(this.escapeRegex(activityId)) }).first();
      const byIdOption = this.page.getByRole('option', { name: new RegExp(this.escapeRegex(activityId)) }).first();
      const byIdText = this.page.getByText(new RegExp(this.escapeRegex(activityId))).first();
      if (await byIdCheckbox.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await byIdCheckbox.click();
        await expect(byIdCheckbox).toBeChecked({ timeout: 2_000 });
      } else if (await byIdOption.isVisible({ timeout: 1_500 }).catch(() => false)) {
        await byIdOption.click();
      } else if (await byIdText.isVisible({ timeout: 1_500 }).catch(() => false)) {
        await byIdText.click();
      } else {
        throw new Error(`Activity "${activityCode}" (id ${activityId}) not found.`);
      }
    } else {
      throw new Error(`Activity "${activityCode}" not found.`);
    }

    console.log(`✅ Activity code "${activityCode}" selected`);
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(500);
  }

  private escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }


  /**
   * Closes the properties panel
   */
  async closePanel() {
    console.log('Closing properties panel (click X)...');
    
    try {
      const codegenClose = this.page.locator('.flex.items-center.gap-1 > button:nth-child(2)');
      const closePanelBtn = this.page.getByRole('button', { name: /close panel|close/i });
      const xButton = this.page.getByRole('button', { name: /close/i }).filter({ has: this.page.locator('svg') });
      const closeButton = xButton.or(codegenClose).or(closePanelBtn).or(
        this.page.getByRole('button').filter({ hasText: '' }).last()
      );
      
      if (await closeButton.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
        await closeButton.first().click({ timeout: 5000 });
      } else {
        console.log('Using Escape key to close panel...');
        await this.page.keyboard.press('Escape');
      }
      
      // Verify panel is closed by checking if name input is hidden
      await expect(this.nameInput).toBeHidden({ timeout: 5_000 });
      console.log('✅ Properties panel closed');
      
    } catch (error) {
      console.log('⚠️ Warning: Could not verify panel closure, continuing anyway...');
    }
    
    await this.page.waitForTimeout(1000);
  }


  /**
   * Fills all properties in the workflow properties panel
   */
  /** Known activity id for "Home" (used when dropdown shows id). */
  private static readonly HOME_ACTIVITY_ID = '10100002';

  async fillProperties(data: {
    name: string;
    description: string;
    publishChannel: string;
    activityCodes: string;
    /** Optional activity id (e.g. Home = 10100002). */
    activityId?: string;
  }) {
    await this.waitForPanelReady();

    if (!data.name || !data.name.trim()) {
      throw new Error(
        'PropertiesPanel.fillProperties: "name" is required (it was empty/undefined). ' +
          'Set WORKFLOW_NAME / WORKFLOW_NAME_AGENT_TOOL / WORKFLOW_NAME_GUARDRAIL / WORKFLOW_NAME_LLM in your .env or docker run -e.'
      );
    }
    if (!data.description || !data.description.trim()) {
      throw new Error('PropertiesPanel.fillProperties: "description" is required (it was empty/undefined).');
    }
    if (!data.publishChannel || !data.publishChannel.trim()) {
      throw new Error('PropertiesPanel.fillProperties: "publishChannel" is required (it was empty/undefined).');
    }
    if (!data.activityCodes || !data.activityCodes.trim()) {
      throw new Error(
        'PropertiesPanel.fillProperties: "activityCodes" is required (it was empty/undefined). ' +
          'Set ACTIVITY_CODES (or ACTIVITY_CODE) in your .env or docker run -e.'
      );
    }
    
    console.log('Filling workflow properties...');
    
    // Fill name and description (strict: must not be empty)
    await this.nameInput.first().clear();
    await this.nameInput.first().fill(data.name);
    await this.page.waitForTimeout(300);
    await this.ensureNameAndDescriptionFilled(data.name, data.description);
    
    await this.descriptionInput.first().clear();
    await this.descriptionInput.first().fill(data.description);
    await this.page.waitForTimeout(300);
    await this.ensureNameAndDescriptionFilled(data.name, data.description);
    
    console.log(`✅ Name: ${data.name}`);
    console.log(`✅ Description: ${data.description}`);
    
    // Handle Qi UI checkbox
    if (data.publishChannel.toLowerCase().includes('qi ui') || data.publishChannel.toLowerCase() === 'both') {
      console.log('Selecting Qi UI...');
      
      const qiUiCard = this.page
        .getByRole('heading', { name: /^qi ui$/i, level: 3 })
        .locator('..')
        .locator('..');
      
      await expect(qiUiCard).toBeVisible({ timeout: 10_000 });
      
      const checkbox = qiUiCard.getByRole('checkbox');
      const isChecked = await checkbox.isChecked();
      
      if (!isChecked) {
        await qiUiCard.click();
        await expect(checkbox).toBeChecked({ timeout: 5_000 });
        console.log('✅ Qi UI selected');
      } else {
        console.log('✅ Qi UI already selected');
      }
      
      await this.page.waitForTimeout(500);
    }
    
    const activityId = data.activityId ?? (data.activityCodes.trim().toLowerCase() === 'home' ? PropertiesPanel.HOME_ACTIVITY_ID : undefined);
    await this.selectActivityCode(data.activityCodes, activityId);
    
    await this.page.waitForTimeout(500);
    await this.ensureNameAndDescriptionFilled(data.name, data.description);
    console.log('✅ Properties filled successfully');
  }

  /**
   * Strict constraint: Name and Description must be non-empty in the panel.
   * Verifies current values; if empty, re-fills once and asserts again.
   */
  private async ensureNameAndDescriptionFilled(expectedName: string, expectedDescription: string): Promise<void> {
    await this.page.waitForTimeout(400);
    const nameEl = this.nameInput.first();
    const descEl = this.descriptionInput.first();
    const nameValue = await nameEl.inputValue().catch(() => '');
    const descValue = await descEl.inputValue().catch(() => '');
    if (!nameValue.trim()) {
      console.log('Name field was empty; re-filling...');
      await nameEl.fill(expectedName);
      await this.page.waitForTimeout(300);
      const after = await nameEl.inputValue().catch(() => '');
      if (!after.trim()) {
        throw new Error('PropertiesPanel: Name field is required and must not be empty after fill.');
      }
    }
    if (!descValue.trim()) {
      console.log('Description field was empty; re-filling...');
      await descEl.fill(expectedDescription);
      await this.page.waitForTimeout(300);
      const after = await descEl.inputValue().catch(() => '');
      if (!after.trim()) {
        throw new Error('PropertiesPanel: Description field is required and must not be empty after fill.');
      }
    }
  }
}
