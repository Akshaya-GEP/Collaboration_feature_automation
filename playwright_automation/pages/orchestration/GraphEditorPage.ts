import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';

export class GraphEditorPage {
  constructor(private readonly page: Page) {}

  get runButton(): Locator {
    return this.page.getByRole('button', { name: /^run$/i });
  }

  get interfaceButton(): Locator {
    return this.page.getByRole('button', { name: /^interface$/i });
  }

  get chatInput(): Locator {
    return this.page.getByPlaceholder('Type your message here... (press enter to send)');
  }

  get startNode(): Locator {
    // Match button containing "START" heading text
    return this.page.getByRole('button', { name: /START.*start.*Starting point/i });
  }

  // Agent node - match button with agent_0 text
  agentNode(index = 0): Locator {
    return this.page.getByRole('button', { name: /AGENT_\d+.*agent/i }).nth(index);
  }

  // LLM node
  llmNode(index = 0): Locator {
    // Canvas node accessible name can be like:
    // - "llm_0 LLM"
    // - "llm_node LLM OpenAI GPT-4.1"
    return this.page.getByRole('button', { name: /llm_[\w-]+\s+llm/i }).nth(index);
  }

  // Guardrail node
  guardrailNode(index = 0): Locator {
    return this.page.getByRole('button', { name: /guardrail_[\w-]+\s+guardrail/i }).nth(index);
  }

  // Rule node - match button with rule_0 / rule_1 etc. (label may be "Rule" or "rule" before/after id)
  ruleNode(index = 0): Locator {
    return this.page.getByRole('button', { name: /rule_\d+/i }).nth(index);
  }

  // Variable node - match button with variable_0 / variable_1 etc.
  variableNode(index = 0): Locator {
    return this.page.getByRole('button', { name: /variable_[\w-]+\s+variable/i }).nth(index);
  }

  // Output node - match button with OUTPUT text
  get outputNode(): Locator {
    return this.page.getByRole('button', { name: /OUTPUT.*output.*Final output/i });
  }

  // Any output node (includes additional output nodes dragged from the nodes panel)
  outputNodeByIndex(index = 0): Locator {
    return this.page.getByRole('button', { name: /output(_[\w-]+)?\s+output/i }).nth(index);
  }

  get lastOutputNode(): Locator {
    return this.page.getByRole('button', { name: /output(_[\w-]+)?\s+output/i }).last();
  }

  /**
   * Link two nodes by dragging from source to target
   * This simulates the visual connection drawing in the workflow editor
   */
  async linkNodes(
    fromNode: Locator,
    toNode: Locator,
    options?: { fromPort?: 'default' | 'pass' | 'fail' }
  ) {
    console.log('Creating connection between nodes...');
    
    // Wait for both nodes to be visible
    await expect(fromNode).toBeVisible({ timeout: 10_000 });
    await expect(toNode).toBeVisible({ timeout: 10_000 });
    
    // Get bounding boxes to find connection points
    const fromBox = await fromNode.boundingBox();
    const toBox = await toNode.boundingBox();
    
    if (!fromBox || !toBox) {
      throw new Error('Could not get node positions for linking');
    }
    
    // Calculate connection points (right edge of source, left edge of target)
    const fromX = fromBox.x + fromBox.width; // Right edge of source node
    const port = options?.fromPort ?? 'default';
    const fromYOffset =
      port === 'pass' ? 0.25 : port === 'fail' ? 0.75 : 0.5; // aim at different handles
    const fromY = fromBox.y + fromBox.height * fromYOffset;
    
    const toX = toBox.x;  // Left edge of target node
    const toY = toBox.y + toBox.height / 2;  // Middle of target node
    
    // Perform drag operation to create connection
    await this.page.mouse.move(fromX, fromY);
    await this.page.waitForTimeout(300);
    
    await this.page.mouse.down();
    await this.page.waitForTimeout(300);
    
    await this.page.mouse.move(toX, toY, { steps: 10 });
    await this.page.waitForTimeout(300);
    
    await this.page.mouse.up();
    await this.page.waitForTimeout(500);
    
    console.log('✅ Connection created');
  }

  async clickRun() {
    console.log('Clicking Run button...');
    await expect(this.runButton).toBeVisible({ timeout: 5_000 });
    await this.runButton.click();
    console.log('✅ Workflow started');
  }

  /**
   * Ensures the chat interface is visible (some runs require clicking "Interface" after Run).
   */
  async openChat() {
    if (await this.chatInput.isVisible().catch(() => false)) return;

    if (await this.interfaceButton.isVisible().catch(() => false)) {
      await this.interfaceButton.click();
    }

    await expect(this.chatInput).toBeVisible({ timeout: 30_000 });
  }
}
