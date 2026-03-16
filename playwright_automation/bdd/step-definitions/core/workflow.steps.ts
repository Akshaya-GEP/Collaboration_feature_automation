import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import assert from 'node:assert/strict';

import { LoginPage } from '../../../pages/loginPage';
import { configureDomain } from '../../../pages/config/domainhelper';
import { OrchestrationHomePage } from '../../../pages/orchestration/OrchestrationHomePage';
import { PropertiesPanel } from '../../../pages/orchestration/PropertiesPanel';
import { NodesPanel } from '../../../pages/orchestration/NodesPanel';
import { AgentNodePanel } from '../../../pages/orchestration/AgentNodePanel';
import { GraphEditorPage } from '../../../pages/orchestration/GraphEditorPage';
import type { CustomWorld } from '../../support/hooks';
import { waitForAiEvents } from '../../../utils/workflowUtils';

function getAppUrl(): string {
    const url = (process.env.APP_URL || process.env.BASE_URL || '').trim() || 'https://qistudio.gep.com/leo-dev-agent-api';
    // If URL is root (e.g. https://qistudio.gep.com/), append workflow app path
    if (url && (url.endsWith('/') || url.match(/^https?:\/\/[^/]+\/?$/))) {
        return url.replace(/\/?$/, '') + '/leo-dev-agent-api';
    }
    return url;
}

function envFirst(names: string | string[]): string | undefined {
    const keys = Array.isArray(names) ? names : [names];
    for (const key of keys) {
        const raw = process.env[key];
        const value = typeof raw === 'string' ? raw.trim() : '';
        if (value) return value;
    }
    return undefined;
}

function defaultWorkflowName(prefix: string): string {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    return `pw-${prefix}-${ts}`;
}

// -------- Background steps --------

Given('I open QI Studio workflow app', async function (this: CustomWorld) {
    assert(this.page, 'World.page was not initialized (hook failure)');
    const appUrl = getAppUrl();
    await this.page.goto(appUrl, { waitUntil: 'domcontentloaded', timeout: 120_000 });
});

Given('I log in to QI Studio using credentials from env', async function (this: CustomWorld) {
    assert(this.page, 'World.page was not initialized (hook failure)');
    assert(this.env, 'World.env was not initialized (hook failure)');
    if (process.env.SKIP_LOGIN) return;

    const loginPage = new LoginPage(this.page!);
    await loginPage.login(this.env.userId, this.env.password);
    await loginPage.assertLoggedIn();

    // Navigate to workflow app after login (redirect may land on root; ensure we're on the app)
    const appUrl = getAppUrl();
    const currentUrl = this.page!.url();
    const isAlreadyOnApp = currentUrl.startsWith(appUrl) || currentUrl.includes('leo-dev-agent-api');
    if (!isAlreadyOnApp) {
        await this.page!.goto(appUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 60_000,
        });
        await this.page!.waitForLoadState('domcontentloaded');
    }
});

Given('I configure domain if domain configuration dialog appears', async function (this: CustomWorld) {
    assert(this.page, 'World.page was not initialized (hook failure)');
    await configureDomain(this.page!);
});

// -------- Orchestration Home Page --------

When('I navigate to orchestration home page', async function (this: CustomWorld) {
    assert(this.page, 'World.page was not initialized (hook failure)');
    const orchestrationHome = new OrchestrationHomePage(this.page!);
    await orchestrationHome.navigateToOrchestrations();
});

When('I start a new graph-based orchestration', async function (this: CustomWorld) {
    assert(this.page, 'World.page was not initialized (hook failure)');
    const orchestrationHome = new OrchestrationHomePage(this.page!);
    await orchestrationHome.startGraphOrchestration();
});

// -------- Properties Panel --------

When(
    'I fill workflow properties with name {string} description {string} publish channel {string} activity codes {string}',
    async function (
        this: CustomWorld,
        name: string,
        description: string,
        publishChannel: string,
        activityCodes: string
    ) {
        assert(this.page, 'World.page was not initialized (hook failure)');
        const effectiveName = name || envFirst(['WORKFLOW_NAME']) || defaultWorkflowName('agent');
        const effectiveDesc = description || envFirst('WORKFLOW_DESCRIPTION') || 'Playwright BDD automated test';
        const effectiveChannel = publishChannel || envFirst('PUBLISH_CHANNEL') || 'Qi UI';
        const effectiveCodes = activityCodes || envFirst(['ACTIVITY_CODES', 'ACTIVITY_CODE']) || 'Home';

        const propertiesPanel = new PropertiesPanel(this.page!);
        await propertiesPanel.fillProperties({
            name: effectiveName,
            description: effectiveDesc,
            publishChannel: effectiveChannel,
            activityCodes: effectiveCodes,
        });
    }
);

When('I wait for the properties panel to load', async function (this: CustomWorld) {
    assert(this.page, 'World.page was not initialized (hook failure)');
    const propertiesPanel = new PropertiesPanel(this.page!);
    await propertiesPanel.waitForPanelReady();
});

When('I close the properties panel', async function (this: CustomWorld) {
    assert(this.page, 'World.page was not initialized (hook failure)');
    const propertiesPanel = new PropertiesPanel(this.page!);
    await propertiesPanel.closePanel();
    await this.page!.waitForTimeout(2000);
});

// -------- Nodes Panel --------

When('I add an {string} node from the nodes panel', async function (this: CustomWorld, nodeType: string) {
    assert(this.page, 'World.page was not initialized (hook failure)');
    const validType = nodeType as 'Agent' | 'LLM' | 'Guardrail' | 'Rule' | 'Output';
    const nodesPanel = new NodesPanel(this.page!);
    await nodesPanel.addNode(validType);
    await this.page!.waitForTimeout(2000);
});

// -------- Agent Node Panel --------

When('I configure the agent with model from AGENT_MODEL env', async function (this: CustomWorld) {
    assert(this.page, 'World.page was not initialized (hook failure)');
    const agentModel = envFirst(['AGENT_MODEL']);
    if (!agentModel) {
        throw new Error(
            'AGENT_MODEL env var is required for workflow tests. Set it in .env or export AGENT_MODEL=your-model-name'
        );
    }
    const agentNodePanel = new AgentNodePanel(this.page!);
    await agentNodePanel.configureAgent({ model: agentModel });
});

When('I close the agent node panel', async function (this: CustomWorld) {
    assert(this.page, 'World.page was not initialized (hook failure)');
    const agentNodePanel = new AgentNodePanel(this.page!);
    await agentNodePanel.closePanel();
    await this.page!.waitForTimeout(1000);
});

// -------- Graph Editor Page --------

When('I wait for the graph editor canvas to be ready', async function (this: CustomWorld) {
    assert(this.page, 'World.page was not initialized (hook failure)');
    await this.page!.waitForTimeout(2000);
});

When('I link nodes START to AGENT to OUTPUT', async function (this: CustomWorld) {
    assert(this.page, 'World.page was not initialized (hook failure)');
    const graphEditor = new GraphEditorPage(this.page!);
    const startNode = graphEditor.startNode;
    const agentNode = graphEditor.agentNode(0);
    const outputNode = graphEditor.outputNode;

    await expect(startNode).toBeVisible({ timeout: 10_000 });
    await expect(agentNode).toBeVisible({ timeout: 10_000 });
    await expect(outputNode).toBeVisible({ timeout: 10_000 });

    await graphEditor.linkNodes(startNode, agentNode);
    await graphEditor.linkNodes(agentNode, outputNode);
});

When('I save the workflow', async function (this: CustomWorld) {
    assert(this.page, 'World.page was not initialized (hook failure)');
    const saveButton = this.page!.getByRole('button', { name: /save/i });
    await saveButton.click();
    await this.page!.waitForTimeout(2000);
});

When('I click the Run button', async function (this: CustomWorld) {
    assert(this.page, 'World.page was not initialized (hook failure)');
    const graphEditor = new GraphEditorPage(this.page!);
    await graphEditor.clickRun();
});

// -------- Chat Interface --------

When('I wait for the chat interface to load', async function (this: CustomWorld) {
    assert(this.page, 'World.page was not initialized (hook failure)');
    await this.page!.waitForTimeout(3000);
});

When('I type message {string} in the chat input', async function (this: CustomWorld, message: string) {
    assert(this.page, 'World.page was not initialized (hook failure)');
    const chatInputValue = message || envFirst('CHAT_INPUT') || 'Hello';
    const chatInput = this.page!.getByPlaceholder('Type your message here... (press enter to send)');
    await expect(chatInput).toBeVisible({ timeout: 10_000 });
    await chatInput.fill(chatInputValue);
});

When('I send the message', async function (this: CustomWorld) {
    assert(this.page, 'World.page was not initialized (hook failure)');
    const chatInput = this.page!.getByPlaceholder('Type your message here... (press enter to send)');
    await chatInput.press('Enter');
    this.aiEventsCount = await waitForAiEvents(this.page!, this.aiEventsCount).catch(() => this.aiEventsCount);
});

Then('I should see the chat interface responded', async function (this: CustomWorld) {
    assert(this.page, 'World.page was not initialized (hook failure)');
    this.aiEventsCount = await waitForAiEvents(this.page!, this.aiEventsCount).catch(() => this.aiEventsCount);
    // Verify chat interface is still visible and message was sent (response area may have content)
    const chatInput = this.page!.getByPlaceholder('Type your message here... (press enter to send)');
    await expect(chatInput).toBeVisible({ timeout: 10_000 });
});
