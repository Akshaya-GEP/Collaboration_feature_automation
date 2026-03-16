import { test, expect } from '@playwright/test';
import { Sidebar } from '../../pages/components/Sidebar';
import { login } from '../../pages/auth/loginhelper';
import { configureDomain } from '../../pages/config/domainhelper';
import { OrchestrationHomePage } from '../../pages/orchestration/OrchestrationHomePage';
import { PropertiesPanel } from '../../pages/orchestration/PropertiesPanel';
import { NodesPanel } from '../../pages/orchestration/NodesPanel';
import { AgentNodePanel } from '../../pages/orchestration/AgentNodePanel';
import { GraphEditorPage } from '../../pages/orchestration/GraphEditorPage';
import { envFirst, defaultWorkflowName } from '../helpers/env';

const appUrl = envFirst('APP_URL') ?? 'https://dev-qi.gep.com/?dc=eyJjIjoiREVWRUxPUEVSRE9NQUlOIiwiZCI6IjIwMjEwNTExIiwiZSI6IkRFViIsImEiOiJmMzAxMzFkOS0yM2VmLTQ4YjItODI2Ni1mOWIxNGUwZGNhOTYiLCJtIjoiYzM0MTRjOTQtZDg4My00MjBlLWJhMGUtNTdhZTIyNzg4NjMwIiwibiI6IkRFVkVMT1BFUkRPTUFJTiIsInYiOiJ2MTc3MzUwNzY1NzM4MzYyMTQwMCJ9';
const skipLogin = envFirst('SKIP_LOGIN');
const freshBrowser = envFirst('FRESH_BROWSER');

test.use({ storageState: freshBrowser ? undefined : 'auth.json' });

test.describe('Dashboard - test1: full setup then create workflow', () => {
  test('test1: full setup then create workflow with Agent node and save', async ({ page }) => {
    test.setTimeout(300_000);

    // -------- NAVIGATE TO APP --------
    await page.goto(appUrl, { waitUntil: 'domcontentloaded' });

    if (!skipLogin) {
      const emailInput = page.locator('#i0116, input[type="email"]');
      const passwordInput = page.locator('#i0118, input[type="password"]').or(page.getByPlaceholder(/password/i));
      const emailVisible = await emailInput.isVisible({ timeout: 25000 }).catch(() => false);
      const passwordVisible = await passwordInput.isVisible({ timeout: 25000 }).catch(() => false);
      if (emailVisible || passwordVisible) {
        await login(page);
        await page.goto(appUrl);
        await page.waitForLoadState('domcontentloaded');
      }
    }

    await configureDomain(page);

    const sidebar = new Sidebar(page);
    await sidebar.goToDashboard();
    await page.waitForLoadState('domcontentloaded');

    const publishGroup = page.getByRole('button', { name: /publish/i }).locator('..');
    const chevronButton = publishGroup.locator('button[aria-haspopup="menu"]').filter({ has: page.locator('svg.lucide-chevron-down') });
    await expect(chevronButton.first()).toBeVisible({ timeout: 10_000 });
    await chevronButton.first().click();
    await page.getByRole('menuitem', { name: /version history/i }).click();
    await page.waitForTimeout(1000);

    const firstRow = page.locator('table tbody tr').first();
    const eyeButton = firstRow.locator('button').filter({ has: page.locator('svg.lucide-eye') });
    await expect(eyeButton.first()).toBeVisible({ timeout: 10_000 });
    await eyeButton.first().hover();
    await page.waitForTimeout(300);
    await eyeButton.first().click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForLoadState('load', { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(2000);

    await expect(page.getByRole('button', { name: 'Enable Editing' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Enable Editing' }).click();
    await expect(page.getByRole('dialog', { name: 'Enable editing?' })).toBeVisible();
    await page.getByRole('button', { name: 'Create draft' }).click();
    await expect(page.getByRole('dialog', { name: 'Draft Created' })).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();

    await page.getByRole('button', { name: 'AR' }).click();
    const profileMenu = page.getByRole('menu', { name: 'AR' });
    await expect(profileMenu).toBeVisible({ timeout: 5000 });
    const experimentalSwitch = profileMenu.getByRole('switch');
    await expect(experimentalSwitch).toBeVisible();
    if ((await experimentalSwitch.getAttribute('aria-checked')) !== 'true') {
      await experimentalSwitch.click();
    }
    await page.keyboard.press('Escape');
    await expect(page.getByText('Experimental Features')).toBeHidden({ timeout: 3000 });

    const peopleIcon = page.locator('button').filter({ has: page.locator('svg.lucide-users') }).first();
    await expect(peopleIcon).toBeVisible({ timeout: 5000 });
    await peopleIcon.dblclick();
    await expect(page.getByRole('dialog', { name: /invite collaborators/i })).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(1500);
    await page.getByPlaceholder('name@gep.com').fill('vignesh.voddam@gep.com');
    await page.getByRole('button', { name: 'Invite' }).click();
    await page.waitForTimeout(3000);
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('dialog', { name: /invite collaborators/i })).toBeHidden({ timeout: 3000 });

    // -------- CREATE WORKFLOW: Create button → canvas → Properties → close → add Agent → link → Save --------
    const orchestrationHome = new OrchestrationHomePage(page);
    await orchestrationHome.startGraphOrchestration();

    const propertiesPanel = new PropertiesPanel(page);
    await propertiesPanel.fillProperties({
      name: envFirst('WORKFLOW_NAME') ?? defaultWorkflowName('test1'),
      description: envFirst('WORKFLOW_DESCRIPTION') ?? 'Playwright test1 workflow',
      publishChannel: envFirst('PUBLISH_CHANNEL') ?? 'Qi UI',
      activityCodes: envFirst(['ACTIVITY_CODES', 'ACTIVITY_CODE']) ?? 'Home',
    });
    await propertiesPanel.closePanel();
    await page.waitForTimeout(2000);

    const nodesPanel = new NodesPanel(page);
    await nodesPanel.addNode('Agent');
    await page.waitForTimeout(2000);
    const agentNodePanel = new AgentNodePanel(page);
    await agentNodePanel.configureAgent({ model: 'gpt-4o-mini' });
    await agentNodePanel.closePanel();
    await page.waitForTimeout(1000);

    const graphEditor = new GraphEditorPage(page);
    await page.waitForTimeout(2000);
    const startNode = graphEditor.startNode;
    const agentNode = graphEditor.agentNode(0);
    const outputNode = graphEditor.outputNode;
    await expect(startNode).toBeVisible({ timeout: 10_000 });
    await expect(agentNode).toBeVisible({ timeout: 10_000 });
    await expect(outputNode).toBeVisible({ timeout: 10_000 });
    await graphEditor.linkNodes(startNode, agentNode);
    await graphEditor.linkNodes(agentNode, outputNode);

    await page.getByRole('button', { name: /save/i }).click();
    await page.waitForTimeout(2000);
  });
});
