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

  // Script node
  scriptNode(index = 0): Locator {
    return this.page.getByRole('button', { name: /script_[\w-]+\s+script/i }).nth(index);
  }

  // API (HTTP Request) node — accessible name is like "api_0 http request POST ..."
  apiNode(index = 0): Locator {
    return this.page.getByRole('button', { name: /api[\s_]?\d+.*http/i }).nth(index);
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
   * Link two nodes by dragging from source to target.
   * When fromPort is 'pass' or 'fail', the drag starts from the actual
   * React Flow handle element (data-handleid="pass" / "fail") so the
   * connection attaches to the correct port.
   */
  async linkNodes(
    fromNode: Locator,
    toNode: Locator,
    options?: { fromPort?: 'default' | 'pass' | 'fail' }
  ) {
    const port = options?.fromPort ?? 'default';
    console.log(`Creating connection (port: ${port})...`);

    await expect(fromNode).toBeVisible({ timeout: 10_000 });
    await expect(toNode).toBeVisible({ timeout: 10_000 });

    let fromX: number;
    let fromY: number;

    if (port === 'pass' || port === 'fail') {
      // Locate the exact React Flow handle element inside (or next to) the node
      const handle = fromNode.locator(`[data-handleid="${port}"]`).first();
      const handleVisible = await handle.isVisible({ timeout: 3_000 }).catch(() => false);

      if (handleVisible) {
        const hBox = await handle.boundingBox();
        if (hBox) {
          fromX = hBox.x + hBox.width / 2;
          fromY = hBox.y + hBox.height / 2;
          console.log(`  Using handle element for port "${port}" at (${fromX}, ${fromY})`);
        } else {
          throw new Error(`Handle "${port}" found but has no bounding box`);
        }
      } else {
        // Fallback: percentage-based offset on the node box
        const fromBox = await fromNode.boundingBox();
        if (!fromBox) throw new Error('Could not get source node position');
        fromX = fromBox.x + fromBox.width;
        const yOffset = port === 'pass' ? 0.35 : 0.65;
        fromY = fromBox.y + fromBox.height * yOffset;
        console.log(`  Handle element not found; using fallback offset for "${port}"`);
      }
    } else {
      const fromBox = await fromNode.boundingBox();
      if (!fromBox) throw new Error('Could not get source node position');
      fromX = fromBox.x + fromBox.width;
      fromY = fromBox.y + fromBox.height * 0.5;
    }

    const toBox = await toNode.boundingBox();
    if (!toBox) throw new Error('Could not get target node position');
    const toX = toBox.x;
    const toY = toBox.y + toBox.height / 2;

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
