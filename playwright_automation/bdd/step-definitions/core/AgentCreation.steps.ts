import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import assert from 'node:assert/strict';
import type { CustomWorld } from '../../support/hooks';
import { waitForAiEvents } from '../../../utils/workflowUtils';
import { NodesPanel } from '../../../pages/orchestration/NodesPanel';

When('I navigate to Agentic Orchestrations', async function (this: CustomWorld) {
    assert(this.page, 'World.page was not initialized');
    console.log('[DEBUG] Navigating to Agentic Orchestrations...');

    // Wait for the navigation menu/SPA to be fully interactive
    await this.page.waitForTimeout(2000);

    const navLink = this.page.getByText('Agentic Orchestrations', { exact: true })
        .or(this.page.getByRole('link', { name: 'Agentic Orchestrations', exact: true }))
        .or(this.page.locator('a:has-text("Agentic Orchestrations")'))
        .first();

    console.log('[DEBUG] Clicking Agentic Orchestrations link...');
    await expect(navLink).toBeVisible({ timeout: 30_000 });
    await navLink.scrollIntoViewIfNeeded();
    await navLink.click({ force: true });

    // Wait for URL and main container to confirm landing
    await this.page.waitForURL(/.*agentic-orchestrations.*/, { timeout: 15_000 }).catch(() => { });
    await expect(this.page.locator('main').first()).toBeVisible({ timeout: 15_000 });
    console.log('✅ Navigation to Agentic Orchestrations complete');
});

When('I click to Create a new agent workflow', async function (this: CustomWorld) {
    assert(this.page, 'World.page was not initialized');
    console.log('[DEBUG] Clicking Create button...');

    const createBtn = this.page.getByRole('button', { name: 'Create', exact: true })
        .or(this.page.getByRole('button', { name: /create/i }))
        .first();

    await expect(createBtn).toBeVisible({ timeout: 20_000 });
    await createBtn.scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(1000); // Wait for potential animations
    await createBtn.click({ force: true });

    console.log('Waiting for Properties panel to settle...');
    // We expect the 'Name' input to appear. 
    // Usually the panel has a header or card with 'Properties' or 'Orchestration Details'
    const nameInput = this.page.locator('#agent-name')
        .or(this.page.getByRole('textbox', { name: /orchestration name|name/i }))
        .first();

    await expect(nameInput).toBeVisible({ timeout: 20_000 });
    
    // Wait for the description as well to confirm panel is fully loaded
    const descInput = this.page.locator('#description')
        .or(this.page.getByRole('textbox', { name: /description/i }))
        .first();
    await expect(descInput).toBeVisible({ timeout: 10_000 });
    
    await this.page.waitForTimeout(1000);
    console.log('✅ Properties panel is open and loaded');
});

Then('the orchestration canvas should be visible', async function (this: CustomWorld) {
    assert(this.page, 'World.page was not initialized');
    await expect(this.page.getByTestId('rf__node-start')).toBeVisible({ timeout: 15_000 });
});

When('I set the agent name to {string}', async function (this: CustomWorld, name: string) {
    assert(this.page, 'World.page was not initialized');
    console.log(`Setting agent name to: "${name}"`);
    // id="agent-name", placeholder="Name of the orchestration"
    const nameInput = this.page.locator('#agent-name')
        .or(this.page.getByPlaceholder('Name of the orchestration'))
        .or(this.page.getByPlaceholder('Untitled'))
        .or(this.page.getByRole('textbox', { name: /name\*|^name$/i }));
    await expect(nameInput.first()).toBeVisible({ timeout: 10_000 });
    const input = nameInput.first();
    await input.scrollIntoViewIfNeeded();
    await input.click();
    await input.press('ControlOrMeta+a');
    await input.fill(name);
    console.log(`✅ Agent name set: "${name}"`);
});

When('I set the agent description to {string}', async function (this: CustomWorld, description: string) {
    assert(this.page, 'World.page was not initialized');
    console.log(`Setting agent description to: "${description}"`);
    const descInput = this.page.locator('#description')
        .or(this.page.getByPlaceholder('Short summary of what this orchestration does'))
        .or(this.page.locator('textarea[placeholder*="Short summary"]'))
        .or(this.page.getByPlaceholder(/short summary/i))
        .or(this.page.getByRole('textbox', { name: /description\*|^description$/i }))
        .or(this.page.locator('textarea').first());
    await expect(descInput.first()).toBeVisible({ timeout: 10_000 });
    const input = descInput.first();
    await input.scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(300);
    await input.click({ force: true });
    await this.page.waitForTimeout(200);
    // React controlled component: use native setter + dispatch events so value persists
    await input.evaluate((el: HTMLTextAreaElement, text: string) => {
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
        if (setter) {
            setter.call(el, text);
        } else {
            el.value = text;
        }
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }, description);
    await input.press('Tab');
    await this.page.waitForTimeout(500);
    const nameInput = this.page.locator('#agent-name').first();
    if (await nameInput.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await nameInput.click();
        await this.page.waitForTimeout(300);
    }
    console.log(`✅ Agent description set: "${description}"`);
});

When('I save the properties panel', async function (this: CustomWorld) {
    assert(this.page, 'World.page was not initialized');
    console.log('Clicking Save button (after properties panel closed)...');
    await this.page.waitForTimeout(1000); // Ensure panel is fully closed

    const saveBtn = this.page.getByRole('button', { name: /^Save$/i }).first();
    await expect(saveBtn).toBeVisible({ timeout: 10_000 });

    // Wait for the save response
    const saveResponsePromise = this.page.waitForResponse(response => 
        response.url().includes('agentic-orchestrations') && 
        (response.request().method() === 'POST' || response.request().method() === 'PUT'),
        { timeout: 30_000 }
    ).catch(() => null);

    await saveBtn.click();
    
    const response = await saveResponsePromise;
    if (response) {
        console.log(`✅ Save response received: ${response.status()}`);
    }

    // Wait for success toast
    const toast = this.page.getByText(/successfully/i).first();
    await expect(toast).toBeVisible({ timeout: 10_000 }).catch(() => {});
    
    await this.page.waitForTimeout(2000);
    console.log('✅ Properties saved');
});

When('I select the publish channel {string}', async function (this: CustomWorld, channel: string) {
    assert(this.page, 'World.page was not initialized');
    // Qi UI: codegen uses checkbox.nth(1); API uses different selector
    if (/qi ui/i.test(channel)) {
        const qiCheckbox = this.page.getByRole('checkbox').nth(1);
        if (await qiCheckbox.isVisible({ timeout: 3_000 }).catch(() => false)) {
            await qiCheckbox.click();
        } else {
            await this.page.locator('div').filter({ hasText: new RegExp(`^ ${channel} $`) }).first().click();
        }
    } else {
        await this.page.locator('div').filter({ hasText: new RegExp(`^ ${channel} $`) }).first().click();
    }
});

When('I search and select activity {string} as {string}', async function (this: CustomWorld, searchQuery: string, activityName: string) {
    assert(this.page, 'World.page was not initialized');
    const searchInput = this.page.getByRole('textbox', { name: 'Search and select activities' });
    await searchInput.click();
    await searchInput.fill(searchQuery);
    await this.page.getByRole('button', { name: activityName }).click();
});

When('I open the Add Node panel', async function (this: CustomWorld) {
    // No-op: the Add Node panel is opened as part of 'I add an {string} node' via NodesPanel.addNode()
    console.log('(Add Node panel will open when adding node)');
});

When('I add an {string} node', async function (this: CustomWorld, nodeType: string) {
    assert(this.page, 'World.page was not initialized');
    console.log(`Adding "${nodeType}" node via NodesPanel...`);
    const nodesPanel = new NodesPanel(this.page);
    // addNode() opens the panel, clicks the node type, waits for canvas, and double-clicks to open settings
    await nodesPanel.addNode(nodeType as 'LLM' | 'Agent' | 'Guardrail' | 'Rule' | 'Output');
    console.log(`✅ "${nodeType}" node added and settings panel opened`);
});

Then('I should see the Agent issues panel', async function (this: CustomWorld) {
    assert(this.page, 'World.page was not initialized');
    await expect(this.page.getByRole('button', { name: 'Issues' })).toBeVisible();
});

When('I open the agent node settings', async function (this: CustomWorld) {
    assert(this.page, 'World.page was not initialized');
    // NodesPanel.addNode() already double-clicked the node — just wait for the panel to appear
    console.log('Waiting for agent settings panel...');
    // Wait for any sign the agent config panel is open (Instructions region or Model dropdown)
    const panelReady = this.page.getByRole('region', { name: 'Instructions' })
        .or(this.page.getByRole('combobox').nth(1))
        .or(this.page.getByText('Select model'));
    const alreadyOpen = await panelReady.first().isVisible({ timeout: 5_000 }).catch(() => false);
    if (!alreadyOpen) {
        console.log('Panel not open yet, double-clicking agent node...');
        const agentNode = this.page.getByRole('button', { name: /AGENT_\d+.*agent/i }).first();
        await agentNode.dblclick();
        await expect(panelReady.first()).toBeVisible({ timeout: 15_000 });
    }
    console.log('✅ Agent node settings panel is open');
});

When('I configure the agent model to {string}', async function (this: CustomWorld, modelName: string) {
    assert(this.page, 'World.page was not initialized');
    console.log(`Selecting model: "${modelName}"`);
    // Model dropdown is 2nd combobox (0: Agent Strategy, 1: Model)
    const modelDropdown = this.page.getByRole('combobox').nth(1);
    await expect(modelDropdown).toBeVisible({ timeout: 15_000 });
    await modelDropdown.click();
    await this.page.waitForTimeout(500);
    const option = this.page.getByRole('option', { name: modelName, exact: true });
    await expect(option).toBeVisible({ timeout: 10_000 });
    await option.click();
    console.log(`✅ Model selected: "${modelName}"`);
});


When('I set the agent instructions to {string}', async function (this: CustomWorld, instructions: string) {
    assert(this.page, 'World.page was not initialized');
    console.log('Writing prompt in Instructions field...');
    // Codegen: .max-h-[300px] > div or textbox with default "You are a helpful AI"
    const instructionsBox = this.page.locator('.max-h-\\[300px\\] > div').first()
        .or(this.page.getByRole('textbox').filter({ hasText: /you are a helpful|you are task/i }))
        .or(this.page.getByRole('region', { name: 'Instructions' }).locator('[contenteditable="true"], textarea').first());
    await expect(instructionsBox).toBeVisible({ timeout: 10_000 });
    await instructionsBox.click();
    await this.page.keyboard.press('ControlOrMeta+a');
    await this.page.keyboard.type(instructions);
    console.log('✅ Agent instructions set');
});

When('I close the agent node settings panel', async function (this: CustomWorld) {
    assert(this.page, 'World.page was not initialized');
    // Try the close-panel button; fall back to Escape
    const closeBtn = this.page.getByRole('button', { name: /close panel/i })
        .or(this.page.getByLabel('close panel'));
    if (await closeBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await closeBtn.click();
    } else {
        await this.page.keyboard.press('Escape');
    }
    await this.page.waitForTimeout(1000);
    console.log('✅ Agent settings panel closed');
    // If the Properties panel has re-opened (it can re-appear after linking), close it too
    const propPanel = this.page.getByRole('textbox', { name: 'Name*' })
        .or(this.page.getByRole('textbox', { name: 'Name' }));
    if (await propPanel.isVisible({ timeout: 2_000 }).catch(() => false)) {
        const propClose = this.page.locator('[data-testid="close-panel"], [aria-label="close"]')
            .or(this.page.getByRole('button', { name: /close/i }).last());
        if (await propClose.isVisible({ timeout: 2_000 }).catch(() => false)) {
            await propClose.click();
        } else {
            await this.page.keyboard.press('Escape');
        }
        await this.page.waitForTimeout(500);
    }
});

When('I save the agent workflow', async function (this: CustomWorld) {
    assert(this.page, 'World.page was not initialized');
    console.log('Saving agent workflow...');
    const saveBtn = this.page.getByRole('button', { name: 'Save' }).first();
    await expect(saveBtn).toBeVisible({ timeout: 10_000 });

    const saveResponsePromise = this.page.waitForResponse(response => 
        response.url().includes('agentic-orchestrations') && 
        (response.request().method() === 'POST' || response.request().method() === 'PUT'),
        { timeout: 30_000 }
    ).catch(() => null);

    await saveBtn.click();
    await saveResponsePromise;
    
    const toast = this.page.getByText(/successfully/i).first();
    await expect(toast).toBeVisible({ timeout: 10_000 }).catch(() => {});
    await this.page.waitForTimeout(1000);
    console.log('✅ Agent workflow saved');
});

When('I run the agent workflow', async function (this: CustomWorld) {
    assert(this.page, 'World.page was not initialized');
    // Mandatory: click Save before Run
    console.log('Clicking Save button (mandatory before Run)...');
    const saveBtn = this.page.getByRole('button', { name: /^Save$/i }).first();
    await expect(saveBtn).toBeVisible({ timeout: 10_000 });

    const saveResponsePromise = this.page.waitForResponse(response => 
        response.url().includes('agentic-orchestrations') && 
        (response.request().method() === 'POST' || response.request().method() === 'PUT'),
        { timeout: 20_000 }
    ).catch(() => null);

    await saveBtn.click();
    await saveResponsePromise;

    // Optional wait for toast to clear or spinner to finish
    await this.page.waitForTimeout(1500);

    // Close Properties panel if it re-opened
    const propPanel = this.page.getByRole('textbox', { name: /^Name/i });
    if (await propPanel.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await this.page.keyboard.press('Escape');
        await this.page.waitForTimeout(500);
    }
    // Mandatory: click Run button to open chat (use force to bypass overlay intercept)
    const runBtn = this.page.getByRole('button', { name: /^Run$/i }).first();
    await expect(runBtn).toBeVisible({ timeout: 15_000 });
    await runBtn.scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(1000); // Wait for Save transition
    
    console.log('Clicking Run...');
    await runBtn.click({ force: true });
    
    // Check if chat opened, if not, try once more after a short wait
    const chatOpened = await this.page.getByPlaceholder(/type your message/i).first().isVisible({ timeout: 5000 }).catch(() => false);
    if (!chatOpened) {
        console.log('Chat didn\'t appear immediately, retrying Run click...');
        await runBtn.click({ force: true });
    }

    await this.page.waitForTimeout(2000);
    console.log('✅ Run clicked and transition started');
});

Then('the chat interface should be visible', async function (this: CustomWorld) {
    assert(this.page, 'World.page was not initialized');
    console.log('Waiting for chat interface to open...');
    
    const chatInputSelector = 'textarea[placeholder*="message"], input[placeholder*="message"], [placeholder*="Type your message"]';
    
    let chatInput = this.page.locator(chatInputSelector).first()
        .or(this.page.getByPlaceholder(/type your message|message here/i))
        .or(this.page.getByPlaceholder('Type your message here... (press enter to send)'));

    // Persistent check for visibility
    let visible = false;
    for (let i = 0; i < 3; i++) {
        visible = await chatInput.isVisible({ timeout: 10_000 }).catch(() => false);
        if (visible) break;
        
        console.log(`Chat not visible (attempt ${i + 1}/3) — retrying Run/Focus actions...`);
        // Fallback: Click Run again if visible
        const runBtn = this.page.getByRole('button', { name: /^Run$/i }).first();
        if (await runBtn.isVisible().catch(() => false)) {
            await runBtn.click({ force: true });
        } else {
            // Or try the 'R' shortcut
            await this.page.keyboard.press('r');
        }
        await this.page.waitForTimeout(3000);
    }

    await expect(chatInput).toBeVisible({ timeout: 20_000 });
    console.log('✅ Chat interface is visible');
});

When('this step will fail intentionally', async function (this: CustomWorld) {
    throw new Error('This is an intentional failure to verify the report attachment functionality.');
});


When('I type and send message {string} in the chat', async function (this: CustomWorld, message: string) {
    assert(this.page, 'World.page was not initialized');
    console.log(`Entering user prompt: "${message}"`);
    const chatInput = this.page.getByPlaceholder('Type your message here... (press enter to send)')
        .or(this.page.getByPlaceholder(/type your message|message here/i))
        .or(this.page.locator('textarea[placeholder*="message"], input[placeholder*="message"]').first());
    await expect(chatInput).toBeVisible({ timeout: 15_000 });
    await chatInput.click();
    await chatInput.fill(message);
    await chatInput.press('Enter');
    this.aiEventsCount = await waitForAiEvents(this.page, this.aiEventsCount).catch(() => this.aiEventsCount);
    console.log('✅ Message sent');
});

Then('I receive a response in the chat', async function (this: CustomWorld) {
    assert(this.page, 'World.page was not initialized');
    this.aiEventsCount = await waitForAiEvents(this.page, this.aiEventsCount).catch(() => this.aiEventsCount);
    console.log('Waiting for agent response...');
    // Wait up to 90 seconds for the AI agent to reply
    // Wait for assistant/response message (AI reply) to appear after user's message
    const responseMsg = this.page.locator(
        '[class*="message"],[class*="chat-bubble"],[class*="response"],[class*="assistant"],[class*="bot"],[class*="markdown"]'
    ).last();
    await expect(responseMsg).not.toBeEmpty({ timeout: 90_000 });
    console.log('✅ Response received - Test PASSED! Successful end-to-end run.');
});

When('I close the chat panel', async function (this: CustomWorld) {
    assert(this.page, 'World.page was not initialized');
    console.log('Closing chat panel...');
    // Try close button (aria-label or title)
    const closeBtn = this.page
        .getByRole('button', { name: /close/i })
        .or(this.page.locator('[aria-label="close"], [title="Close"]'));
    if (await closeBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await closeBtn.first().click();
    }
    console.log('✅ Chat panel closed');
});
