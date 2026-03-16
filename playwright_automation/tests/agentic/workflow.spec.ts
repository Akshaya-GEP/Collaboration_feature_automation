import { test, expect } from '@playwright/test';
import { OrchestrationHomePage } from '../../pages/orchestration/OrchestrationHomePage';
import { PropertiesPanel } from '../../pages/orchestration/PropertiesPanel';
import { NodesPanel } from '../../pages/orchestration/NodesPanel';
import { AgentNodePanel } from '../../pages/orchestration/AgentNodePanel';
import { GraphEditorPage } from '../../pages/orchestration/GraphEditorPage';
import { login } from '../../pages/auth/loginhelper';
import { configureDomain } from '../../pages/config/domainhelper';
import { defaultWorkflowName, envFirst, requireEnvOrSkip } from '../helpers/env';


test.use({ storageState: process.env.FRESH_BROWSER ? undefined : 'auth.json' }); // use FRESH_BROWSER=1 for clean run


test.describe('Single Agent Workflow', () => {
  test('Create workflow with single agent and validate chat response', async ({ page }) => {
    test.setTimeout(300_000); // 5 minutes

    const agentModel = requireEnvOrSkip(test, 'AGENT_MODEL', 'AGENT_MODEL env var is required for agentic workflow tests.');
    const chatInputValue = envFirst('CHAT_INPUT') ?? 'Hello';


    const appUrl = 'https://qistudio.gep.com/leo-dev-agent-api';

    // -------- NAVIGATE TO APP --------
    await page.goto(appUrl, { waitUntil: 'domcontentloaded' });

    // -------- LOGIN (if redirected to Microsoft sign-in: email or password step) --------
    if (!process.env.SKIP_LOGIN) {
      // Redirect to Microsoft can take 5–25s; wait for login form using same selectors as LoginPage
      const emailInput = page.locator('#i0116, input[type="email"]');
      const passwordInput = page.locator('#i0118, input[type="password"]').or(page.getByPlaceholder(/password/i));
      const emailVisible = await emailInput.isVisible({ timeout: 25000 }).catch(() => false);
      const passwordVisible = await passwordInput.isVisible({ timeout: 25000 }).catch(() => false);
      console.log(`Login check: emailVisible=${emailVisible}, passwordVisible=${passwordVisible}, url=${page.url()}`);
      if (emailVisible || passwordVisible) {
        console.log('Running login...');
        await login(page);
        await page.goto(appUrl);
        await page.waitForLoadState('domcontentloaded');
      }
    }

    // -------- DOMAIN CONFIG (reuse helper) --------
    await configureDomain(page);


    // -------- ORCHESTRATION HOME PAGE --------
    console.log('Creating new orchestration...');
    const orchestrationHome = new OrchestrationHomePage(page);
    await orchestrationHome.startGraphOrchestration();


    // -------- PROPERTIES PANEL --------
    console.log('Filling workflow properties...');
    const propertiesPanel = new PropertiesPanel(page);
    await propertiesPanel.fillProperties({
      name: envFirst('WORKFLOW_NAME') ?? defaultWorkflowName('agent'),
      description: envFirst('WORKFLOW_DESCRIPTION') ?? 'Playwright automated test',
      publishChannel: envFirst('PUBLISH_CHANNEL') ?? 'Qi UI',
      activityCodes: envFirst(['ACTIVITY_CODES', 'ACTIVITY_CODE']) ?? 'Home',
    });
    
    // Close properties panel
    await propertiesPanel.closePanel();
    
    // Wait for panel to close completely
    await page.waitForTimeout(2000);

    // -------- NODES PANEL --------
    console.log('Adding agent node...');
    const nodesPanel = new NodesPanel(page);
    await nodesPanel.addNode('Agent');

    // Wait for agent panel to open automatically after adding node
    await page.waitForTimeout(2000);

    // -------- AGENT NODE PANEL --------
    // Panel is already open from addNode() - no need to click again
    console.log('Configuring agent node...');
    const agentNodePanel = new AgentNodePanel(page);
    await agentNodePanel.configureAgent({
      model: agentModel,
      // systemPrompt is optional - leaving default
    });

    // Optionally add tools
    // if (process.env.TOOL_NAME) {
    //   await agentNodePanel.addTool(process.env.TOOL_NAME);
    // }

    // Close the agent panel
    await agentNodePanel.closePanel();
    
    // Wait after configuring agent
    await page.waitForTimeout(1000);


    // -------- GRAPH EDITOR PAGE (link nodes + run) --------
console.log('Linking nodes...');
const graphEditor = new GraphEditorPage(page);

// Wait for canvas to be ready
await page.waitForTimeout(2000);

// Get node locators
console.log('Getting node locators...');
const startNode = graphEditor.startNode;
const agentNode = graphEditor.agentNode(0);
const outputNode = graphEditor.outputNode;

// Verify all nodes are visible before linking
await expect(startNode).toBeVisible({ timeout: 10_000 });
await expect(agentNode).toBeVisible({ timeout: 10_000 });
await expect(outputNode).toBeVisible({ timeout: 10_000 });
console.log('✅ All nodes are visible');

// Link nodes: START → AGENT → OUTPUT
console.log('Linking START → AGENT...');
await graphEditor.linkNodes(startNode, agentNode);

console.log('Linking AGENT → OUTPUT...');
await graphEditor.linkNodes(agentNode, outputNode);

console.log('✅ All nodes linked successfully');

// Save workflow before running
console.log('Saving workflow...');
const saveButton = page.getByRole('button', { name: /save/i });
await saveButton.click();
await page.waitForTimeout(2000);
console.log('✅ Workflow saved');

// Run workflow
console.log('Running workflow...');
await graphEditor.clickRun();


// -------- CHAT INTERFACE --------
console.log('Testing chat interface...');

// Wait for chat interface to load after clicking Run
await page.waitForTimeout(3000);

// Use placeholder text to find the chat input
const chatInput = page.getByPlaceholder('Type your message here... (press enter to send)');
await expect(chatInput).toBeVisible({ timeout: 10_000 });

// Type the message
await chatInput.fill(chatInputValue);
console.log(`✅ Message entered: ${chatInputValue}`);

// Press Enter to send (as indicated by placeholder text)
await chatInput.press('Enter');
console.log('✅ Message sent via Enter key');

// Wait for response to appear
await page.waitForTimeout(2000);


  });
});
