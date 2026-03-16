import { test, expect, chromium } from '@playwright/test';
import { Sidebar } from '../../pages/components/Sidebar';
import { login } from '../../pages/auth/loginhelper';
import { configureDomain } from '../../pages/config/domainhelper';
import { OrchestrationHomePage } from '../../pages/orchestration/OrchestrationHomePage';
import { PropertiesPanel } from '../../pages/orchestration/PropertiesPanel';
import { GraphEditorPage } from '../../pages/orchestration/GraphEditorPage';
import { AgentNodePanel } from '../../pages/orchestration/AgentNodePanel';
import { pasteWorkflowJsonFromBdd } from '../../pages/orchestration/JsonWorkflowHelper';
import { envFirst, requireEnvOrSkip } from '../helpers/env';

const appUrl = envFirst('APP_URL') ?? 'https://dev-qi.gep.com/?dc=eyJjIjoiREVWRUxPUEVSRE9NQUlOIiwiZCI6IjIwMjEwNTExIiwiZSI6IkRFViIsImEiOiJmMzAxMzFkOS0yM2VmLTQ4YjItODI2Ni1mOWIxNGUwZGNhOTYiLCJtIjoiYzM0MTRjOTQtZDg4My00MjBlLWJhMGUtNTdhZTIyNzg4NjMwIiwibiI6IkRFVkVMT1BFUkRPTUFJTiIsInYiOiJ2MTc3MzUwNzY1NzM4MzYyMTQwMCJ9';
const skipLogin = envFirst('SKIP_LOGIN');
const freshBrowser = envFirst('FRESH_BROWSER');
const freshBrowserB = envFirst('FRESH_BROWSER_B');
const workflowName = envFirst('COLLAB_WORKFLOW_NAME') ?? 'BDD AGENT';
const workflowDescription = 'Collaboration test workflow';
const collabWorkflowJsonPath = envFirst('COLLAB_WORKFLOW_JSON') ?? 'bdd/data/core/agent_testcase1.json';

const AUTH_A = 'auth.json';
const AUTH_B = 'authB.json';

/**
 * Collaboration State Update test.
 * Reuses the same flow as collaboration.spec.ts up to opening the Agent Node panel in both browsers,
 * then: expand State Update in A and B, add state update in A (variable, Append, value), save in A,
 * and assert the update appears in B.
 */
test.describe('Collaboration - State Update', () => {
  test('collab: A adds state update; B sees it after save', async () => {
    test.setTimeout(400_000);

    const loginUrl = envFirst('LOGIN_URL');
    const isHeaded = !!envFirst('HEADED');
    const totalWidth = Number(envFirst('SCREEN_WIDTH')) || 1920;
    const totalHeight = Number(envFirst('SCREEN_HEIGHT')) || 1080;
    const widthHalf = Math.floor(totalWidth / 2);
    const heightFull = totalHeight;
    const windowSize = `${widthHalf},${heightFull}`;

    const browserA = await chromium.launch({
      headless: !isHeaded,
      args: isHeaded ? ['--window-position=0,0', `--window-size=${windowSize}`] : [],
    });
    const browserB = await chromium.launch({
      channel: 'msedge',
      headless: !isHeaded,
      args: isHeaded ? [`--window-position=${widthHalf},0`, `--window-size=${windowSize}`] : [],
    });

    const storageStateA = freshBrowser ? undefined : AUTH_A;
    const contextA = await browserA.newContext({
      viewport: { width: widthHalf, height: heightFull },
      storageState: storageStateA,
      ignoreHTTPSErrors: true,
      permissions: ['clipboard-read', 'clipboard-write'],
    });

    let contextB: Awaited<ReturnType<typeof browserB.newContext>>;
    let usedAuthB = false;
    if (freshBrowserB) {
      contextB = await browserB.newContext({
        viewport: { width: widthHalf, height: heightFull },
        ignoreHTTPSErrors: true,
        permissions: ['clipboard-read', 'clipboard-write'],
      });
    } else {
      try {
        contextB = await browserB.newContext({
          viewport: { width: widthHalf, height: heightFull },
          storageState: AUTH_B,
          ignoreHTTPSErrors: true,
          permissions: ['clipboard-read', 'clipboard-write'],
        });
        usedAuthB = true;
      } catch {
        contextB = await browserB.newContext({
          viewport: { width: widthHalf, height: heightFull },
          ignoreHTTPSErrors: true,
          permissions: ['clipboard-read', 'clipboard-write'],
        });
      }
    }

    const userBEmail = requireEnvOrSkip(test, ['USER_EMAIL_B', 'USER_B_EMAIL'], 'Set USER_EMAIL_B or USER_B_EMAIL in .env for the invite collaborators field and Browser B.');
    const userBPassword = usedAuthB ? '' : requireEnvOrSkip(test, ['USER_PASSWORD_B', 'USER_B_PASSWORD'], 'Set USER_PASSWORD_B or USER_B_PASSWORD in .env for the invitee (Browser B), or run once with credentials to create authB.json.');

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      // ---------- Reuse: Browser A — navigate, login, domain, dashboard, invite B ----------
      await pageA.goto(appUrl, { waitUntil: 'domcontentloaded' });
      if (!skipLogin) {
        const emailInputA = pageA.locator('#i0116, input[type="email"]');
        const passwordInputA = pageA.locator('#i0118, input[type="password"]').or(pageA.getByPlaceholder(/password/i));
        const needLoginA = await emailInputA.isVisible({ timeout: 15000 }).catch(() => false)
          || await passwordInputA.isVisible({ timeout: 15000 }).catch(() => false);
        if (needLoginA) {
          await login(pageA);
          await pageA.goto(appUrl);
          await pageA.waitForLoadState('domcontentloaded');
        }
      }
      await configureDomain(pageA);

      const sidebarA = new Sidebar(pageA);
      await sidebarA.goToDashboard();
      await pageA.waitForLoadState('domcontentloaded');

      const publishGroupA = pageA.getByRole('button', { name: /publish/i }).locator('..');
      const chevronA = publishGroupA.locator('button[aria-haspopup="menu"]').filter({ has: pageA.locator('svg.lucide-chevron-down') });
      await expect(chevronA.first()).toBeVisible({ timeout: 10_000 });
      await chevronA.first().click();
      await pageA.getByRole('menuitem', { name: /version history/i }).click();
      await pageA.waitForTimeout(1000);

      const firstRowA = pageA.locator('table tbody tr').first();
      const eyeA = firstRowA.locator('button').filter({ has: pageA.locator('svg.lucide-eye') });
      await expect(eyeA.first()).toBeVisible({ timeout: 10_000 });
      await eyeA.first().hover();
      await pageA.waitForTimeout(300);
      await eyeA.first().click();
      await pageA.waitForLoadState('domcontentloaded');
      await pageA.waitForLoadState('load', { timeout: 15_000 }).catch(() => {});
      await pageA.waitForTimeout(2000);

      await expect(pageA.getByRole('button', { name: 'Enable Editing' })).toBeVisible({ timeout: 15_000 });
      await pageA.getByRole('button', { name: 'Enable Editing' }).click();
      await expect(pageA.getByRole('dialog', { name: 'Enable editing?' })).toBeVisible();
      await pageA.getByRole('button', { name: 'Create draft' }).click();
      await expect(pageA.getByRole('dialog', { name: 'Draft Created' })).toBeVisible();
      await pageA.getByRole('button', { name: 'Close' }).click();

      await pageA.getByRole('button', { name: 'AR' }).click();
      const profileMenuA = pageA.getByRole('menu', { name: 'AR' });
      await expect(profileMenuA).toBeVisible({ timeout: 5000 });
      const experimentalSwitchA = profileMenuA.getByRole('switch');
      if ((await experimentalSwitchA.getAttribute('aria-checked')) !== 'true') {
        await experimentalSwitchA.click();
      }
      await pageA.keyboard.press('Escape');

      const peopleIconA = pageA.locator('button').filter({ has: pageA.locator('svg.lucide-users') }).first();
      await expect(peopleIconA).toBeVisible({ timeout: 5000 });
      await peopleIconA.dblclick();
      await expect(pageA.getByRole('dialog', { name: /invite collaborators/i })).toBeVisible({ timeout: 5000 });
      await pageA.waitForTimeout(1500);
      await pageA.getByPlaceholder('name@gep.com').fill(userBEmail);
      await pageA.getByRole('button', { name: 'Invite' }).click();
      await pageA.waitForTimeout(3000);
      await pageA.getByRole('button', { name: 'Done' }).click();
      await expect(pageA.getByRole('dialog', { name: /invite collaborators/i })).toBeHidden({ timeout: 5000 });

      // ---------- Reuse: Browser A — Create workflow, properties, JSON, save ----------
      const orchestrationHomeA = new OrchestrationHomePage(pageA);
      await orchestrationHomeA.startGraphOrchestration();

      const propertiesPanelA = new PropertiesPanel(pageA);
      const name = workflowName.trim();
      const description = workflowDescription.trim();
      test.skip(!name || !description, 'Strict: Name and Description are required (non-empty). Set COLLAB_WORKFLOW_NAME in .env if needed.');
      await propertiesPanelA.fillProperties({
        name,
        description,
        publishChannel: envFirst('PUBLISH_CHANNEL') ?? 'Qi UI',
        activityCodes: envFirst(['ACTIVITY_CODES', 'ACTIVITY_CODE']) ?? 'Home',
      });
      await propertiesPanelA.closePanel();
      await pageA.waitForTimeout(2000);
      await pageA.getByRole('button', { name: /save/i }).click();
      await pageA.waitForTimeout(3000);

      await pasteWorkflowJsonFromBdd(pageA, collabWorkflowJsonPath);
      await pageA.getByRole('button', { name: /save/i }).click();
      await pageA.waitForTimeout(2000);

      const graphEditorABeforeB = new GraphEditorPage(pageA);
      await graphEditorABeforeB.agentNode(0).dblclick();
      await pageA.waitForTimeout(1500);
      await expect(
        pageA.getByRole('region', { name: /instructions/i }).or(pageA.getByRole('button', { name: /close panel/i })).first()
      ).toBeVisible({ timeout: 10_000 });

      const workflowPageUrl = pageA.url();

      // ---------- Reuse: Browser B — login, navigate to same workflow ----------
      await pageB.goto(appUrl, { waitUntil: 'domcontentloaded' });
      const emailInputB = pageB.locator('#i0116, input[type="email"]');
      const passwordInputB = pageB.locator('#i0118, input[type="password"]').or(pageB.getByPlaceholder(/password/i));
      const needLoginB = await emailInputB.isVisible({ timeout: 15000 }).catch(() => false)
        || await passwordInputB.isVisible({ timeout: 15000 }).catch(() => false);
      if (needLoginB) {
        await login(pageB, userBEmail, userBPassword, loginUrl);
        await pageB.goto(appUrl);
        await pageB.waitForLoadState('domcontentloaded');
        await contextB.storageState({ path: AUTH_B });
      }
      await configureDomain(pageB);

      await pageB.goto(workflowPageUrl, { waitUntil: 'domcontentloaded' });
      await pageB.waitForLoadState('load', { timeout: 15_000 }).catch(() => {});
      await pageB.waitForTimeout(2000);

      const graphEditorB = new GraphEditorPage(pageB);
      await expect(graphEditorB.startNode).toBeVisible({ timeout: 25_000 });
      await expect(graphEditorB.agentNode(0)).toBeVisible({ timeout: 25_000 });
      await expect(graphEditorB.outputNode).toBeVisible({ timeout: 25_000 });

      // ---------- Reuse: Open Agent Node panel in both browsers ----------
      const graphEditorA = new GraphEditorPage(pageA);
      await graphEditorA.agentNode(0).dblclick();
      await pageA.waitForTimeout(2000);
      await expect(pageA.getByRole('region', { name: /instructions/i }).or(pageA.getByRole('button', { name: /close panel/i })).first()).toBeVisible({ timeout: 10_000 });

      await graphEditorB.agentNode(0).scrollIntoViewIfNeeded();
      await graphEditorB.agentNode(0).dblclick();
      await expect(pageB.getByRole('region', { name: /instructions/i }).or(pageB.getByRole('button', { name: /close panel/i })).first()).toBeVisible({ timeout: 15_000 });

      // ---------- Step 1: Open State Update panel (expand section) in A, then in B ----------
      const agentPanelA = new AgentNodePanel(pageA);
      const agentPanelB = new AgentNodePanel(pageB);

      await agentPanelA.expandStateUpdateSection();
      await agentPanelB.expandStateUpdateSection();

      // ---------- Step 2: Add a State Update in Browser A ----------
      await agentPanelA.addStateUpdate({
        variable: '{{thread.agent_0_messages}}',
        action: 'Append',
        value: 'Agent 1',
      });

      // ---------- Step 3: Save configuration (Browser A) ----------
      await agentPanelA.closePanel();
      await pageA.getByRole('button', { name: /save/i }).click();
      await pageA.waitForTimeout(3000);

      // ---------- Expected: State update from A appears in B ----------
      await agentPanelB.expectStateUpdateVisible({
        variable: '{{thread.agent_0_messages}}',
        action: 'Append',
        value: 'Agent 1',
      });

      // Wait until the update is visible in B (already asserted above); short wait to observe
      await pageB.waitForTimeout(2000);
    } finally {
      await contextA.close();
      await contextB.close();
      await browserA.close();
      await browserB.close();
    }
  });
});
