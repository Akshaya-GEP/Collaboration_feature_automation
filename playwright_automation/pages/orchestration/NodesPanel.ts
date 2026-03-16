import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';


export class NodesPanel {
  constructor(private readonly page: Page) {}


  private get addNodeButton() {
    return this.page.getByRole('button').filter({ hasText: '+' }).or(
      this.page.locator('button:has(svg):has-text("+")')
    );
  }


  private get nodesTab() {
    return this.page.getByRole('tab', { name: /nodes/i }).or(
      this.page.getByText('Nodes', { exact: true })
    );
  }


  async addNode(
    nodeType: 'LLM' | 'Agent' | 'Guardrail' | 'Rule' | 'Output'
  ) {
    console.log(`Adding ${nodeType} node...`);
    
    await this.page.waitForTimeout(1000);
    
    // Step 1: Open nodes panel
    console.log('Opening nodes panel...');
    const plusButton = this.page.locator('button').filter({
      has: this.page.locator('svg')
    }).first();
    
    await expect(plusButton).toBeVisible({ timeout: 10_000 });
    await plusButton.click();
    await this.page.waitForTimeout(1000);
    console.log('Nodes panel opened');
    
    // Step 2: Click Nodes tab if needed
    try {
      const nodesTabVisible = await this.nodesTab.isVisible({ timeout: 2000 });
      if (nodesTabVisible) {
        console.log('Clicking Nodes tab...');
        await this.nodesTab.click();
        await this.page.waitForTimeout(500);
      }
    } catch (error) {
      console.log('Nodes tab not needed or already active');
    }
    
    // Step 3: Click the node type to add it to canvas
    const nodeElement = this.page
      .locator(`button:has-text("${nodeType}")`)
      .first();
    
    await expect(nodeElement).toBeVisible({ timeout: 10_000 });
    console.log(`Found ${nodeType} node`);
    
    await nodeElement.click({ timeout: 5000 });
    console.log(`✅ ${nodeType} node added to canvas`);
    await this.page.waitForTimeout(2500); // Increased wait time
    
    // Step 4: Find the node on canvas
    console.log(`Finding ${nodeType} node on canvas...`);

    const nodeRegexByType: Record<typeof nodeType, RegExp> = {
      Agent: /agent_\d+/i,
      LLM: /llm_\d+/i,
      Guardrail: /guardrail_\d+/i,
      Rule: /rule_\d+/i,
      Output: /output/i,
    };

    // Prefer the newest node (last) so repeated addNode('Agent') targets agent_1, agent_2, ...
    const nodeOnCanvas = this.page
      .getByRole('button')
      .filter({ hasText: nodeRegexByType[nodeType] })
      .last();

    await expect(nodeOnCanvas).toBeVisible({ timeout: 15_000 });
    console.log(`Found ${nodeType} node on canvas`);

    // Step 5: Double-click to open configuration
    console.log(`Double-clicking ${nodeType} node...`);
    await nodeOnCanvas.dblclick();
    
    console.log(`✅ ${nodeType} configuration panel opened`);
    await this.page.waitForTimeout(3000); // Increased wait for config panel
  }
}
