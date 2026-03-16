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
/** JSON from BDD folder for workflow (e.g. bdd/data/core/agent_testcase1.json) */
const collabWorkflowJsonPath = envFirst('COLLAB_WORKFLOW_JSON') ?? 'bdd/data/core/agent_testcase1.json';

// --- STRICT RULE: do not mix browser or auth ---
// Browser A: Chrome only, User A only, auth.json only.
// Browser B: Edge only,  User B only, authB.json only.
// --- STRICT RULE: double-click Agent node in Browser A before any Browser B steps ---
const AUTH_A = 'auth.json';
const AUTH_B = 'authB.json';

/**
 * Collaboration test: two browsers, same canvas.
 * - Browser A (Chrome, auth.json): dashboard, invite B (userB email in "name@gep.com"), Create workflow, fill properties,
 *   paste JSON from BDD (COLLAB_WORKFLOW_JSON, default bdd/data/core/agent_testcase1.json), save (no Run).
 * - Browser B (Edge, authB.json): login, open same canvas by name; assert workflow (start/agent/output nodes) reflects.
 * - In headed mode, screen split into equal halves. Set SCREEN_WIDTH/SCREEN_HEIGHT and USER_EMAIL_B (or USER_B_EMAIL) in .env.
 */
test.describe('Collaboration - two browsers, same canvas', () => {
  test('collab: A invites B, both open same canvas; A adds agent node and it reflects in B', async () => {
    test.setTimeout(400_000);

    const loginUrl = envFirst('LOGIN_URL');
    const isHeaded = !!envFirst('HEADED');
    // Strict 50-50 split: set SCREEN_WIDTH/SCREEN_HEIGHT in .env to match your display (default 1920x1080)
    const totalWidth = Number(envFirst('SCREEN_WIDTH')) || 1920;
    const totalHeight = Number(envFirst('SCREEN_HEIGHT')) || 1080;
    const widthHalf = Math.floor(totalWidth / 2);
    const heightFull = totalHeight;

    // Browser A: left half (0 to widthHalf) — same width as B for 50-50
    const windowSize = `${widthHalf},${heightFull}`;
    const browserA = await chromium.launch({
      headless: !isHeaded,
      args: isHeaded ? ['--window-position=0,0', `--window-size=${windowSize}`] : [],
    });

    // Browser B: right half (widthHalf to totalWidth) — same width as A for 50-50
    const browserB = await chromium.launch({
      channel: 'msedge',
      headless: !isHeaded,
      args: isHeaded ? [`--window-position=${widthHalf},0`, `--window-size=${windowSize}`] : [],
    });

    // Chrome (Browser A): login by auth.json only — never use authB.json for A
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

    // User B email is always required for the invite step (placeholder "name@gep.com")
    const userBEmail = requireEnvOrSkip(test, ['USER_EMAIL_B', 'USER_B_EMAIL'], 'Set USER_EMAIL_B or USER_B_EMAIL in .env for the invite collaborators field and Browser B.');
    const userBPassword = usedAuthB ? '' : requireEnvOrSkip(test, ['USER_PASSWORD_B', 'USER_B_PASSWORD'], 'Set USER_PASSWORD_B or USER_B_PASSWORD in .env for the invitee (Browser B), or run once with credentials to create authB.json.');

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      // ---------- Browser A: navigate, login if needed, domain, dashboard, invite B ----------
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

      // ---------- Browser A: Create workflow, in properties panel enter Name & Description, then JSON → Sync → close → Save ----------
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

      // Load JSON editor → paste JSON → click Sync changes → close JSON editor → click Save (Browser A)
      await pasteWorkflowJsonFromBdd(pageA, collabWorkflowJsonPath);
      await pageA.getByRole('button', { name: /save/i }).click();
      await pageA.waitForTimeout(2000);

      // STRICT: Double-click Agent node in Browser A before going to Browser B (do not reorder)
      const graphEditorABeforeB = new GraphEditorPage(pageA);
      await graphEditorABeforeB.agentNode(0).dblclick();
      await pageA.waitForTimeout(1500);
      await expect(
        pageA.getByRole('region', { name: /instructions/i }).or(pageA.getByRole('button', { name: /close panel/i })).first()
      ).toBeVisible({ timeout: 10_000 });

      // Copy Browser A page URL (after JSON paste, sync, save) for Browser B
      const workflowPageUrl = pageA.url();

      // ---------- Browser B: login with authB, then paste Browser A URL and redirect ----------
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

      // Paste Browser A page URL in Browser B and redirect to same workflow page
      await pageB.goto(workflowPageUrl, { waitUntil: 'domcontentloaded' });
      await pageB.waitForLoadState('load', { timeout: 15_000 }).catch(() => {});
      await pageB.waitForTimeout(2000);

      // ---------- Browser B: assert workflow from JSON reflects (collab sync) ----------
      const graphEditorB = new GraphEditorPage(pageB);
      const startNodeB = graphEditorB.startNode;
      const agentNodeB = graphEditorB.agentNode(0);
      const outputNodeB = graphEditorB.outputNode;
      await expect(startNodeB).toBeVisible({ timeout: 25_000 });
      await expect(agentNodeB).toBeVisible({ timeout: 25_000 });
      await expect(outputNodeB).toBeVisible({ timeout: 25_000 });

      // ---------- Open agent node in both browsers: first A, then B ----------
      const graphEditorA = new GraphEditorPage(pageA);
      await graphEditorA.agentNode(0).dblclick();
      await pageA.waitForTimeout(2000);
      await expect(pageA.getByRole('region', { name: /instructions/i }).or(pageA.getByRole('button', { name: /close panel/i })).first()).toBeVisible({ timeout: 10_000 });

      await graphEditorB.agentNode(0).scrollIntoViewIfNeeded();
      await graphEditorB.agentNode(0).dblclick();
      await expect(pageB.getByRole('region', { name: /instructions/i }).or(pageB.getByRole('button', { name: /close panel/i })).first()).toBeVisible({ timeout: 15_000 });

      // ---------- In Browser A's agent node: change prompt template; changes must reflect in B ----------
      const agentPanelA = new AgentNodePanel(pageA);
      const promptText = 'you are an ai assistant';
      await agentPanelA.setPromptTemplate(promptText);
      await pageA.waitForTimeout(1000);

      // Collab: Browser B should show the same prompt template (synced)
      await expect(pageB.getByText(promptText)).toBeVisible({ timeout: 15_000 });

      // Again in Browser A: make another change in prompt template; wait for B to reflect and observe
      const promptText2 = 'you are an ai assistant. Be helpful and concise.';
      await agentPanelA.setPromptTemplate(promptText2);
      await pageA.waitForTimeout(1500);

      await expect(pageB.getByText(promptText2)).toBeVisible({ timeout: 15_000 });
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
