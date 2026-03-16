import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export class OrchestrationHomePage {
  constructor(private readonly page: Page) { }

  private get agenticOrchestrationsLink() {
    // Left sidebar only: use navigation so we don't match main content.
    const sidebar = this.page.getByRole('navigation');
    return sidebar.getByRole('link', { name: 'Agentic Orchestrations', exact: true });
  }

  private get graphBasedTab() {
    // UI varies between "Graph Based" being a tab or a plain text label.
    return this.page.getByRole('tab', { name: /graph based/i }).or(this.page.getByText(/graph based/i));
  }

  private get createButton() {
    return this.page.getByRole('button', { name: /create/i, exact: true });
  }

  private escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Navigates to the Agentic Orchestrations page
   */    
  async navigateToOrchestrations() {
    await expect(this.agenticOrchestrationsLink).toBeVisible({ timeout: 20_000 });
    await this.agenticOrchestrationsLink.scrollIntoViewIfNeeded();
    await this.agenticOrchestrationsLink.click({ force: true });

    // Wait for URL to change
    await this.page.waitForURL(/.*agentic-orchestrations.*/, { timeout: 15_000 }).catch(() => { });

    // Wait for the main content area to have content
    await expect(this.page.locator('main')).toBeVisible({ timeout: 15_000 });
  }

  /**
   * Starts creating a graph-based orchestration
   */
  async startGraphOrchestration() {
    await this.navigateToOrchestrations();

    // Graph Based tab may be absent when there is only one orchestration type
    const tabVisible = await this.graphBasedTab.isVisible({ timeout: 5_000 }).catch(() => false);
    if (tabVisible) {
      const isSelected = await this.graphBasedTab.getAttribute('aria-selected').catch(() => null);
      if (isSelected !== 'true') await this.graphBasedTab.click({ force: true });
    }

    // First: click Create button → then Properties panel opens
    await expect(this.createButton).toBeVisible({ timeout: 10_000 });
    await expect(this.createButton).toBeEnabled();
    await this.createButton.scrollIntoViewIfNeeded();
    await this.createButton.click({ force: true });

    console.log('Create clicked; waiting for Properties panel to open...');
    await this.page.waitForTimeout(1500);

    // Wait for the Properties panel (name field) to be visible
    const nameInput = this.page.getByRole('textbox', { name: /orchestration name|name/i }).first()
      .or(this.page.getByPlaceholder('Untitled')).first();
    await expect(nameInput).toBeVisible({ timeout: 20_000 });

    const descInput = this.page.locator('#description')
        .or(this.page.getByRole('textbox', { name: /description/i }))
        .first();
    await expect(descInput).toBeVisible({ timeout: 10_000 });

    await this.page.waitForTimeout(1000);

    // Wait for start and output nodes to be present
    await expect(this.page.getByRole('button', { name: /start.*starting point/i }))
      .toBeVisible({ timeout: 10_000 });

    console.log('✅ Workflow editor loaded successfully');
  }

  /**
   * Opens an existing graph-based orchestration by name (from the list page)
   */
  async openGraphOrchestrationByName(workflowName: string) {
    await this.navigateToOrchestrations();

    await expect(this.graphBasedTab).toBeVisible({ timeout: 10_000 });
    const isSelected = await this.graphBasedTab.getAttribute('aria-selected');
    if (isSelected !== 'true') {
      await this.graphBasedTab.click();
    }

    const nameRe = new RegExp(this.escapeRegExp(workflowName), 'i');

    // Try common patterns: table row, link, or clickable text.
    const row = this.page.getByRole('row', { name: nameRe }).first();
    const link = this.page.getByRole('link', { name: nameRe }).first();
    const text = this.page.getByText(nameRe).first();

    if (await link.isVisible().catch(() => false)) {
      await link.click();
    } else if (await row.isVisible().catch(() => false)) {
      await row.click();
    } else {
      await expect(text).toBeVisible({ timeout: 15_000 });
      await text.click();
    }

    // Wait for editor to load (heading shows workflow name)
    await expect(this.page.getByRole('heading', { name: nameRe })).toBeVisible({ timeout: 20_000 });
    await expect(this.page.getByRole('button', { name: /start.*starting point/i }))
      .toBeVisible({ timeout: 20_000 });
  }
}
