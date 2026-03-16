import { test, expect, chromium } from '@playwright/test';
import { Sidebar } from '../../pages/components/Sidebar';
import { login } from '../../pages/auth/loginhelper';
import { configureDomain } from '../../pages/config/domainhelper';
import { OrchestrationHomePage } from '../../pages/orchestration/OrchestrationHomePage';
import { PropertiesPanel } from '../../pages/orchestration/PropertiesPanel';
import { GraphEditorPage } from '../../pages/orchestration/GraphEditorPage';
import { NodesPanel } from '../../pages/orchestration/NodesPanel';
import { ScriptNodePanel } from '../../pages/orchestration/ScriptNodePanel';
import { envFirst, requireEnvOrSkip } from '../helpers/env';

const appUrl = envFirst('APP_URL') ?? 'https://dev-qi.gep.com/?dc=eyJjIjoiREVWRUxPUEVSRE9NQUlOIiwiZCI6IjIwMjEwNTExIiwiZSI6IkRFViIsImEiOiJmMzAxMzFkOS0yM2VmLTQ4YjItODI2Ni1mOWIxNGUwZGNhOTYiLCJtIjoiYzM0MTRjOTQtZDg4My00MjBlLWJhMGUtNTdhZTIyNzg4NjMwIiwibiI6IkRFVkVMT1BFUkRPTUFJTiIsInYiOiJ2MTc3MzUwNzY1NzM4MzYyMTQwMCJ9';
const skipLogin = envFirst('SKIP_LOGIN');
const freshBrowser = envFirst('FRESH_BROWSER');
const freshBrowserB = envFirst('FRESH_BROWSER_B');
const workflowName = envFirst('COLLAB_SCRIPT_WORKFLOW_NAME') ?? 'BDD SCRIPT COLLAB';
const workflowDescription = 'Collaboration Script node test workflow';

const AUTH_A = 'auth.json';
const AUTH_B = 'authB.json';

/**
 * Collaboration test for Script node: two browsers, same canvas.
 * - Browser A drags a Script node, connects edges (start → Script → output).
 * - Browser B verifies the Script node appears on canvas.
 * - Browser A modifies Script node properties; Browser B verifies real-time sync:
 *   input params, code editor, output JSON schema, state update.
 */
test.describe('Collaboration Script - two browsers, same canvas', () => {
  test('collab: A drags Script node, connects edges, modifies properties; B verifies sync', async () => {
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

    const userBEmail = requireEnvOrSkip(test, ['USER_EMAIL_B', 'USER_B_EMAIL'], 'Set USER_EMAIL_B or USER_B_EMAIL in .env');
    const userBPassword = usedAuthB ? '' : requireEnvOrSkip(test, ['USER_PASSWORD_B', 'USER_B_PASSWORD'], 'Set USER_PASSWORD_B or USER_B_PASSWORD in .env');

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      // ══════════════════════════════════════════════════════════════════
      // Browser A: login, domain, dashboard, enable editing, invite B
      // ══════════════════════════════════════════════════════════════════
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

      // ══════════════════════════════════════════════════════════════════
      // Browser A: Create workflow, fill properties, save
      // ══════════════════════════════════════════════════════════════════
      const orchestrationHomeA = new OrchestrationHomePage(pageA);
      await orchestrationHomeA.startGraphOrchestration();

      const propertiesPanelA = new PropertiesPanel(pageA);
      const name = workflowName.trim();
      const description = workflowDescription.trim();
      test.skip(!name || !description, 'Workflow name and description required.');
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

      // ══════════════════════════════════════════════════════════════════
      // Browser A: Drag Script node onto canvas and connect edges
      // ══════════════════════════════════════════════════════════════════
      const graphEditorA = new GraphEditorPage(pageA);
      const nodesPanelA = new NodesPanel(pageA);

      await pageA.locator('.react-flow__pane').click({ position: { x: 100, y: 100 } });
      await pageA.waitForTimeout(500);

      await nodesPanelA.addNode('Script');
      console.log('✅ Script node dragged onto canvas');

      // Close the Script panel that auto-opened after addNode (dblclick)
      const scriptPanelATemp = new ScriptNodePanel(pageA);
      await scriptPanelATemp.closePanel();
      await pageA.waitForTimeout(1000);

      // Connect edges: start → Script
      await graphEditorA.linkNodes(graphEditorA.startNode, graphEditorA.scriptNode(0));
      console.log('✅ Edge: start → Script connected');
      await pageA.waitForTimeout(500);

      // Connect edges: Script → output
      await graphEditorA.linkNodes(graphEditorA.scriptNode(0), graphEditorA.outputNode);
      console.log('✅ Edge: Script → output connected');

      await pageA.getByRole('button', { name: /save/i }).click();
      await pageA.waitForTimeout(3000);

      const workflowPageUrl = pageA.url();

      // ══════════════════════════════════════════════════════════════════
      // Browser B: login, navigate to same workflow URL
      // ══════════════════════════════════════════════════════════════════
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

      // ══════════════════════════════════════════════════════════════════
      // Browser B: verify Script node visible on canvas
      // ══════════════════════════════════════════════════════════════════
      const graphEditorB = new GraphEditorPage(pageB);
      await expect(graphEditorB.startNode).toBeVisible({ timeout: 25_000 });
      await expect(graphEditorB.scriptNode(0)).toBeVisible({ timeout: 25_000 });
      await expect(graphEditorB.outputNode).toBeVisible({ timeout: 25_000 });
      console.log('✅ Browser B: start, Script, and output nodes visible on canvas');

      // ══════════════════════════════════════════════════════════════════
      // Open Script node in both browsers
      // ══════════════════════════════════════════════════════════════════
      await graphEditorA.scriptNode(0).dblclick();
      await pageA.waitForTimeout(2000);
      await expect(
        pageA.getByText('Code', { exact: true }).or(pageA.getByRole('button', { name: /close panel/i })).first()
      ).toBeVisible({ timeout: 10_000 });

      await graphEditorB.scriptNode(0).scrollIntoViewIfNeeded();
      await graphEditorB.scriptNode(0).dblclick();
      await expect(
        pageB.getByText('Code', { exact: true }).or(pageB.getByRole('button', { name: /close panel/i })).first()
      ).toBeVisible({ timeout: 15_000 });

      const scriptPanelA = new ScriptNodePanel(pageA);
      const scriptPanelB = new ScriptNodePanel(pageB);

      // ══════════════════════════════════════════════════════════════════
      // Property sync tests: A makes changes, B verifies
      // ══════════════════════════════════════════════════════════════════

      // ---------- TITLE ----------
      const newTitle = 'CollabTestScript';
      await scriptPanelA.setTitle(newTitle);
      await scriptPanelB.expectTitle(newTitle);

      // ---------- DESCRIPTION ----------
      const newDescription = 'Collab test script description';
      await scriptPanelA.setDescription(newDescription);
      await scriptPanelB.expectDescription(newDescription);

      // ---------- CODE EDITOR — clear existing code and type new code ----------
      const newCode = 'console.log("hello collab");\nreturn { result: "ok" };';
      await scriptPanelA.setCode(newCode);
      await scriptPanelB.expectCodeContains('hello collab');

      // ---------- OUTPUT JSON SCHEMA ----------
      const outputSchema = '{"type":"object","properties":{"result":{"type":"string"}},"required":["result"],"additionalProperties":false}';
      await scriptPanelA.setOutputSchema(outputSchema);
      await expect(pageB.getByText('result').first()).toBeVisible({ timeout: 15_000 });

      // ---------- STATE UPDATE — add new state (empty by default for script) ----------
      await scriptPanelA.addStateUpdate('testVar', 'testValue');
      await scriptPanelB.ensureStateUpdateSectionOpen();
      const varByText = pageB.getByText('testVar', { exact: true });
      const varByInput = pageB.locator('input[value="testVar"]');
      await expect(varByText.or(varByInput).first()).toBeVisible({ timeout: 15_000 });

      await pageA.waitForTimeout(3000);
      await pageB.waitForTimeout(3000);
    } finally {
      await contextA.close();
      await contextB.close();
      await browserA.close();
      await browserB.close();
    }
  });
});
