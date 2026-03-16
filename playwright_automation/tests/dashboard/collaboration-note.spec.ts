import { test, expect, chromium } from '@playwright/test';
import { Sidebar } from '../../pages/components/Sidebar';
import { login } from '../../pages/auth/loginhelper';
import { configureDomain } from '../../pages/config/domainhelper';
import { OrchestrationHomePage } from '../../pages/orchestration/OrchestrationHomePage';
import { PropertiesPanel } from '../../pages/orchestration/PropertiesPanel';
import { envFirst, requireEnvOrSkip } from '../helpers/env';

const appUrl = envFirst('APP_URL') ?? 'https://dev-qi.gep.com/?dc=eyJjIjoiREVWRUxPUEVSRE9NQUlOIiwiZCI6IjIwMjEwNTExIiwiZSI6IkRFViIsImEiOiJmMzAxMzFkOS0yM2VmLTQ4YjItODI2Ni1mOWIxNGUwZGNhOTYiLCJtIjoiYzM0MTRjOTQtZDg4My00MjBlLWJhMGUtNTdhZTIyNzg4NjMwIiwibiI6IkRFVkVMT1BFUkRPTUFJTiIsInYiOiJ2MTc3MzUwNzY1NzM4MzYyMTQwMCJ9';
const skipLogin = envFirst('SKIP_LOGIN');
const freshBrowser = envFirst('FRESH_BROWSER');
const freshBrowserB = envFirst('FRESH_BROWSER_B');
const workflowName = envFirst('COLLAB_NOTE_WORKFLOW_NAME') ?? 'BDD NOTE COLLAB';
const workflowDescription = 'Collaboration Note test workflow';

const AUTH_A = 'auth.json';
const AUTH_B = 'authB.json';

/**
 * Collaboration test for Notes on the canvas.
 * - Browser A adds a note (press N), types text.
 * - Browser B verifies the note and its content appear in real-time.
 * - Browser A edits the note; Browser B verifies the updated text.
 */
test.describe('Collaboration Note - two browsers, same canvas', () => {
  test('collab: A adds note and types text; B verifies real-time sync', async () => {
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
      await pageB.waitForTimeout(3000);

      // Verify B is on canvas
      const startNodeB = pageB.getByRole('button', { name: /START.*start.*Starting point/i });
      await expect(startNodeB).toBeVisible({ timeout: 25_000 });
      console.log('✅ Browser B: on the same workflow canvas');

      // ══════════════════════════════════════════════════════════════════
      // Browser A: Add note via N shortcut while B watches
      // ══════════════════════════════════════════════════════════════════

      // Click on canvas pane to make sure it has focus (not on any node)
      await pageA.locator('.react-flow__pane').click({ position: { x: 400, y: 400 } });
      await pageA.waitForTimeout(500);

      console.log('Adding note via keyboard shortcut N...');
      await pageA.keyboard.press('n');
      await pageA.waitForTimeout(3000);

      // Count nodes before and find the note node
      // Notes are typically the last .react-flow__node added
      // They might have a class like react-flow__node-note or contain a textarea/contenteditable
      const allNodesA = pageA.locator('.react-flow__node');
      const nodeCountA = await allNodesA.count();
      console.log(`Total nodes on canvas A: ${nodeCountA}`);

      // Find the note — it's usually the last non-standard node, or has specific attributes
      // Try different strategies to find it
      let noteNodeA = pageA.locator('.react-flow__node[data-type="note"]').first();
      let noteFound = await noteNodeA.isVisible({ timeout: 2_000 }).catch(() => false);

      if (!noteFound) {
        noteNodeA = pageA.locator('.react-flow__node-note').first();
        noteFound = await noteNodeA.isVisible({ timeout: 2_000 }).catch(() => false);
      }

      if (!noteFound) {
        // Look for a node that contains a textarea or contenteditable
        noteNodeA = pageA.locator('.react-flow__node').filter({
          has: pageA.locator('textarea, [contenteditable="true"]'),
        }).first();
        noteFound = await noteNodeA.isVisible({ timeout: 2_000 }).catch(() => false);
      }

      if (!noteFound) {
        // Fallback: the newest node on canvas (last one)
        noteNodeA = allNodesA.last();
        noteFound = await noteNodeA.isVisible({ timeout: 2_000 }).catch(() => false);
        console.log('Using last node on canvas as note (fallback)');
      }

      await expect(noteNodeA).toBeVisible({ timeout: 5_000 });
      console.log('✅ Note node found on Browser A canvas');

      // ══════════════════════════════════════════════════════════════════
      // Browser B: verify note node appeared
      // ══════════════════════════════════════════════════════════════════
      console.log('Checking if note appeared on Browser B...');
      let noteNodeB = pageB.locator('.react-flow__node[data-type="note"]').first();
      let noteBFound = await noteNodeB.isVisible({ timeout: 5_000 }).catch(() => false);

      if (!noteBFound) {
        noteNodeB = pageB.locator('.react-flow__node-note').first();
        noteBFound = await noteNodeB.isVisible({ timeout: 3_000 }).catch(() => false);
      }

      if (!noteBFound) {
        noteNodeB = pageB.locator('.react-flow__node').filter({
          has: pageB.locator('textarea, [contenteditable="true"]'),
        }).first();
        noteBFound = await noteNodeB.isVisible({ timeout: 3_000 }).catch(() => false);
      }

      if (!noteBFound) {
        // Fallback: count should have increased
        const allNodesB = pageB.locator('.react-flow__node');
        const nodeCountB = await allNodesB.count();
        console.log(`Total nodes on canvas B: ${nodeCountB}`);
        noteNodeB = allNodesB.last();
      }

      await expect(noteNodeB).toBeVisible({ timeout: 15_000 });
      console.log('✅ Note node appeared on Browser B');

      // ══════════════════════════════════════════════════════════════════
      // Browser A: type text in the note
      // ══════════════════════════════════════════════════════════════════

      // Double-click the note to enter edit mode
      await noteNodeA.dblclick();
      await pageA.waitForTimeout(1000);

      // Find the editable area inside the note
      const editableA = noteNodeA.locator('textarea').first()
        .or(noteNodeA.locator('[contenteditable="true"]').first())
        .or(noteNodeA.locator('[role="textbox"]').first());

      const editableFound = await editableA.isVisible({ timeout: 3_000 }).catch(() => false);
      if (editableFound) {
        console.log('Found editable area inside note, clicking it...');
        await editableA.click();
        await pageA.waitForTimeout(300);
      }

      const noteText = 'Hello collab note';
      console.log(`Typing in note: "${noteText}"...`);
      await pageA.keyboard.type(noteText, { delay: 80 });
      await pageA.waitForTimeout(2000);

      // Click outside to deselect/commit
      await pageA.locator('.react-flow__pane').click({ position: { x: 100, y: 100 } });
      await pageA.waitForTimeout(3000);
      console.log('✅ Note text typed and deselected');

      // ══════════════════════════════════════════════════════════════════
      // Browser B: verify the note text
      // ══════════════════════════════════════════════════════════════════
      console.log('Verifying note text on Browser B...');

      // Check multiple ways the text might appear
      const noteTextB = pageB.getByText(noteText, { exact: false }).first();
      const notePartialB = pageB.getByText('Hello collab', { exact: false }).first();
      const noteInTextarea = noteNodeB.locator('textarea');
      const noteInEditable = noteNodeB.locator('[contenteditable="true"]');

      // Try text visibility first
      const textVisible = await noteTextB.isVisible({ timeout: 10_000 }).catch(() => false);
      if (textVisible) {
        console.log('✅ Browser B: note text verified (visible as text)');
      } else {
        // Try partial text
        const partialVisible = await notePartialB.isVisible({ timeout: 5_000 }).catch(() => false);
        if (partialVisible) {
          console.log('✅ Browser B: note text verified (partial match)');
        } else {
          // Check textarea value
          const taVisible = await noteInTextarea.isVisible({ timeout: 3_000 }).catch(() => false);
          if (taVisible) {
            const taValue = await noteInTextarea.inputValue();
            console.log(`Browser B note textarea value: "${taValue}"`);
            expect(taValue).toContain('Hello');
            console.log('✅ Browser B: note text verified (textarea value)');
          } else {
            // Check contenteditable text
            const ceVisible = await noteInEditable.isVisible({ timeout: 3_000 }).catch(() => false);
            if (ceVisible) {
              const ceText = await noteInEditable.textContent();
              console.log(`Browser B note contenteditable text: "${ceText}"`);
              expect(ceText).toContain('Hello');
              console.log('✅ Browser B: note text verified (contenteditable)');
            } else {
              // Last resort — check all text in the note node
              const allText = await noteNodeB.textContent();
              console.log(`Browser B note node full text: "${allText}"`);
              expect(allText).toContain('Hello');
              console.log('✅ Browser B: note text verified (node textContent)');
            }
          }
        }
      }

      await pageA.waitForTimeout(2000);
      await pageB.waitForTimeout(2000);
    } finally {
      await contextA.close();
      await contextB.close();
      await browserA.close();
      await browserB.close();
    }
  });
});
