import { test, expect, chromium } from '@playwright/test';
import { Sidebar } from '../../pages/components/Sidebar';
import { login } from '../../pages/auth/loginhelper';
import { configureDomain } from '../../pages/config/domainhelper';
import { OrchestrationHomePage } from '../../pages/orchestration/OrchestrationHomePage';
import { PropertiesPanel } from '../../pages/orchestration/PropertiesPanel';
import { GraphEditorPage } from '../../pages/orchestration/GraphEditorPage';
import { NodesPanel } from '../../pages/orchestration/NodesPanel';
import { APINodePanel } from '../../pages/orchestration/APINodePanel';
import { envFirst, requireEnvOrSkip } from '../helpers/env';

const appUrl = envFirst('APP_URL') ?? 'https://dev-qi.gep.com/?dc=eyJjIjoiREVWRUxPUEVSRE9NQUlOIiwiZCI6IjIwMjEwNTExIiwiZSI6IkRFViIsImEiOiJmMzAxMzFkOS0yM2VmLTQ4YjItODI2Ni1mOWIxNGUwZGNhOTYiLCJtIjoiYzM0MTRjOTQtZDg4My00MjBlLWJhMGUtNTdhZTIyNzg4NjMwIiwibiI6IkRFVkVMT1BFUkRPTUFJTiIsInYiOiJ2MTc3MzUwNzY1NzM4MzYyMTQwMCJ9';
const skipLogin = envFirst('SKIP_LOGIN');
const freshBrowser = envFirst('FRESH_BROWSER');
const freshBrowserB = envFirst('FRESH_BROWSER_B');
const workflowName = envFirst('COLLAB_API_WORKFLOW_NAME') ?? 'BDD API COLLAB';
const workflowDescription = 'Collaboration API node test workflow';

const AUTH_A = 'auth.json';
const AUTH_B = 'authB.json';

/**
 * Collaboration test for API (HTTP) node: two browsers, same canvas.
 * - Browser A drags an API node, connects edges (start → API → output).
 * - Browser B verifies the API node appears on canvas.
 * - Browser A modifies API node properties; Browser B verifies real-time sync:
 *   title, description, HTTP method, URL, headers, request body, timeout, state update.
 */
test.describe('Collaboration API - two browsers, same canvas', () => {
  test('collab: A drags API node, connects edges, modifies properties; B verifies sync', async () => {
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

      const workflowPageUrl = pageA.url();

      // ══════════════════════════════════════════════════════════════════
      // Browser B: login, navigate to same workflow URL BEFORE dragging
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

      const graphEditorB = new GraphEditorPage(pageB);
      await expect(graphEditorB.startNode).toBeVisible({ timeout: 25_000 });
      await expect(graphEditorB.outputNode).toBeVisible({ timeout: 25_000 });
      console.log('✅ Browser B: on the same workflow canvas (before API node drag)');

      // ══════════════════════════════════════════════════════════════════
      // Browser A: NOW drag the API node while B is watching
      // ══════════════════════════════════════════════════════════════════
      const graphEditorA = new GraphEditorPage(pageA);
      const nodesPanelA = new NodesPanel(pageA);

      await pageA.locator('.react-flow__pane').click({ position: { x: 100, y: 100 } });
      await pageA.waitForTimeout(500);

      await nodesPanelA.addNode('API');
      console.log('✅ API node dragged onto canvas by Browser A');

      // Close the API panel that auto-opened after addNode (dblclick)
      const apiPanelATemp = new APINodePanel(pageA);
      await apiPanelATemp.closePanel();
      await pageA.waitForTimeout(1000);

      // Connect edges: start → API
      await graphEditorA.linkNodes(graphEditorA.startNode, graphEditorA.apiNode(0));
      console.log('✅ Edge: start → API connected');
      await pageA.waitForTimeout(500);

      // Connect edges: API "On Success" → output
      await graphEditorA.linkNodes(graphEditorA.apiNode(0), graphEditorA.outputNode, { fromPort: 'pass' });
      console.log('✅ Edge: API (On Success) → output connected');
      await pageA.waitForTimeout(500);

      // Connect edges: API "On Failure" → output
      await graphEditorA.linkNodes(graphEditorA.apiNode(0), graphEditorA.outputNode, { fromPort: 'fail' });
      console.log('✅ Edge: API (On Failure) → output connected');

      // Click canvas to defocus any selected node/handle
      await pageA.locator('.react-flow__pane').click({ position: { x: 50, y: 50 } });
      await pageA.waitForTimeout(500);

      // In collab mode (B already on canvas) Save button is hidden — changes auto-save
      const saveBtn = pageA.getByRole('button', { name: /save/i });
      const saveVisible = await saveBtn.isVisible({ timeout: 2_000 }).catch(() => false);
      if (saveVisible) {
        console.log('Clicking Save...');
        await saveBtn.click();
        await pageA.waitForTimeout(3000);
        console.log('✅ Saved');
      } else {
        console.log('ℹ️ No Save button (collab auto-save mode) — waiting for sync...');
        await pageA.waitForTimeout(3000);
      }

      // ══════════════════════════════════════════════════════════════════
      // Browser B: verify API node appeared on canvas in real-time
      // ══════════════════════════════════════════════════════════════════
      console.log('Waiting for API node to appear on Browser B...');
      await expect(graphEditorB.apiNode(0)).toBeVisible({ timeout: 25_000 });
      console.log('✅ Browser B: API node visible on canvas');

      // ══════════════════════════════════════════════════════════════════
      // Open API node in both browsers
      // ══════════════════════════════════════════════════════════════════
      await graphEditorA.apiNode(0).scrollIntoViewIfNeeded();
      await graphEditorA.apiNode(0).dblclick();
      await pageA.waitForTimeout(2000);
      const panelOpenA = pageA.getByText(/api_?\d+/i)
        .or(pageA.getByText('API', { exact: false }))
        .or(pageA.getByPlaceholder(/add name/i))
        .first();
      await expect(panelOpenA).toBeVisible({ timeout: 10_000 });
      console.log('✅ Browser A: API node panel opened');

      await graphEditorB.apiNode(0).scrollIntoViewIfNeeded();
      await graphEditorB.apiNode(0).dblclick();
      await pageB.waitForTimeout(2000);
      const panelOpenB = pageB.getByText(/api_?\d+/i)
        .or(pageB.getByText('API', { exact: false }))
        .or(pageB.getByPlaceholder(/add name/i))
        .first();
      await expect(panelOpenB).toBeVisible({ timeout: 15_000 });
      console.log('✅ Browser B: API node panel opened');

      const apiPanelA = new APINodePanel(pageA);
      const apiPanelB = new APINodePanel(pageB);

      // ══════════════════════════════════════════════════════════════════
      // Property sync tests: A makes changes, B verifies
      // ══════════════════════════════════════════════════════════════════

      // ---------- TITLE ----------
      const newTitle = 'CollabTestAPI';
      await apiPanelA.setTitle(newTitle);
      await apiPanelB.expectTitle(newTitle);

      // ---------- DESCRIPTION ----------
      const newDescription = 'Collab test API description';
      await apiPanelA.setDescription(newDescription);
      await apiPanelB.expectDescription(newDescription);

      // ---------- URL ----------
      const testUrl = 'https://api.example.com/test';
      await apiPanelA.setUrl(testUrl);
      await apiPanelB.expectUrl(testUrl);

      // ---------- HTTP METHOD — change from GET to POST ----------
      await apiPanelA.selectMethod('POST');
      await apiPanelB.expectMethod('POST');

      // ---------- HEADERS — add a header ----------
      await apiPanelA.addHeader('Content-Type', 'application/json');
      await apiPanelB.expectHeaderVisible('Content-Type');

      // ---------- REQUEST BODY (now visible after switching to POST) ----------
      const requestBody = '{"message": "hello collab"}';
      await apiPanelA.setRequestBody(requestBody);
      await apiPanelB.expectBodyContains('hello collab');

      // ---------- TIMEOUT ----------
      await apiPanelA.setTimeout('15000');
      await apiPanelB.expectTimeout('15000');

      // ---------- STATE UPDATE — add new state (empty by default for API) ----------
      await apiPanelA.addStateUpdate('apiResult', 'responseData');
      await apiPanelB.ensureStateUpdateSectionOpen();
      const varByText = pageB.getByText('apiResult', { exact: true });
      const varByInput = pageB.locator('input[value="apiResult"]');
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
