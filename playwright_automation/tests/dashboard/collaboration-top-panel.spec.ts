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
const workflowName = envFirst('COLLAB_TOP_PANEL_WORKFLOW_NAME') ?? 'BDD TOP PANEL COLLAB';
const workflowDescription = 'Collaboration top-panel features test workflow';

const AUTH_A = 'auth.json';
const AUTH_B = 'authB.json';

/**
 * Collaboration tests for top-panel features: Variables, Interface, Skills,
 * Publish Channels, and Security — all in one test flow.
 * Browser A makes changes; Browser B verifies real-time sync.
 */
test.describe('Collaboration Top Panel - two browsers, same canvas', () => {
  test('collab: A modifies top-panel features; B verifies sync', async () => {
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

      const startNodeB = pageB.getByRole('button', { name: /START.*start.*Starting point/i });
      await expect(startNodeB).toBeVisible({ timeout: 25_000 });
      console.log('✅ Browser B: on the same workflow canvas');

      // ══════════════════════════════════════════════════════════════════
      // 1) VARIABLES — A adds a variable; B verifies it appears
      // ══════════════════════════════════════════════════════════════════
      console.log('\n--- VARIABLES TEST ---');

      // Browser B: open Variables panel first so it's watching
      const variablesBtnB = pageB.locator('button').filter({ has: pageB.locator('svg.lucide-variable') }).first();
      await expect(variablesBtnB).toBeVisible({ timeout: 10_000 });
      await variablesBtnB.click();
      await pageB.waitForTimeout(1000);
      await expect(pageB.getByText('Variables', { exact: false }).first()).toBeVisible({ timeout: 10_000 });
      console.log('✅ Browser B: Variables panel opened');

      // Browser A: open Variables panel
      const variablesBtnA = pageA.locator('button').filter({ has: pageA.locator('svg.lucide-variable') }).first();
      await expect(variablesBtnA).toBeVisible({ timeout: 10_000 });
      await variablesBtnA.click();
      await pageA.waitForTimeout(1000);
      await expect(pageA.getByText('Variables', { exact: false }).first()).toBeVisible({ timeout: 10_000 });
      console.log('✅ Browser A: Variables panel opened');

      // Browser A: click "+ Add Variable"
      const addVarBtn = pageA.getByText('Add Variable', { exact: false })
        .or(pageA.getByRole('button', { name: /add variable/i }));
      await expect(addVarBtn.first()).toBeVisible({ timeout: 10_000 });
      await addVarBtn.first().click();
      await pageA.waitForTimeout(1000);

      // The "Add New Variable" dialog should appear
      await expect(pageA.getByText('Add New Variable', { exact: false })).toBeVisible({ timeout: 10_000 });
      console.log('✅ Browser A: Add New Variable dialog opened');

      // Fill the variable name
      const varNameInput = pageA.locator('#name')
        .or(pageA.getByPlaceholder(/customerQuery/i))
        .first();
      await expect(varNameInput).toBeVisible({ timeout: 10_000 });
      await varNameInput.click();
      await varNameInput.fill('collabTestVar');
      await pageA.waitForTimeout(300);
      console.log('✅ Browser A: Variable name filled: collabTestVar');

      // Click "Add Variable" submit button
      const submitBtn = pageA.getByRole('button', { name: 'Add Variable' })
        .or(pageA.locator('button[type="submit"]').filter({ hasText: /add variable/i }));
      await submitBtn.last().click();
      await pageA.waitForTimeout(2000);
      console.log('✅ Browser A: Variable added');

      // Browser B: verify the new variable appears in the Variables panel
      const varOnB = pageB.getByText('collabTestVar', { exact: false }).first();
      await expect(varOnB).toBeVisible({ timeout: 15_000 });
      console.log('✅ Browser B: Variable "collabTestVar" verified in Variables panel');

      // ══════════════════════════════════════════════════════════════════
      // 2) INTERFACE — A modifies Inputs Schema; B verifies after Save
      //    (No need to close Variables — clicking Interface switches panel)
      // ══════════════════════════════════════════════════════════════════
      console.log('\n--- INTERFACE TEST ---');

      // Browser B: switch to Interface panel (purple arrow-right-left icon)
      const interfaceBtnB = pageB.locator('button').filter({ has: pageB.locator('svg.lucide-arrow-right-left') }).first();
      await expect(interfaceBtnB).toBeVisible({ timeout: 10_000 });
      await interfaceBtnB.click();
      await pageB.waitForTimeout(1000);
      await expect(pageB.getByText('Interface', { exact: false }).first()).toBeVisible({ timeout: 10_000 });
      console.log('✅ Browser B: Interface panel opened');

      // Browser A: switch to Interface panel
      const interfaceBtnA = pageA.locator('button').filter({ has: pageA.locator('svg.lucide-arrow-right-left') }).first();
      await expect(interfaceBtnA).toBeVisible({ timeout: 10_000 });
      await interfaceBtnA.click();
      await pageA.waitForTimeout(1000);
      await expect(pageA.getByText('Interface', { exact: false }).first()).toBeVisible({ timeout: 10_000 });
      console.log('✅ Browser A: Interface panel opened');

      // Browser A: modify the Inputs Schema Monaco editor
      const inputsSchemaLabel = pageA.getByText('Inputs Schema', { exact: false }).first();
      await inputsSchemaLabel.scrollIntoViewIfNeeded();
      await pageA.waitForTimeout(500);

      // Click the first Monaco editor (Inputs Schema)
      const inputsMonaco = pageA.locator('.monaco-editor').first();
      await expect(inputsMonaco).toBeVisible({ timeout: 10_000 });
      await inputsMonaco.click();
      await pageA.waitForTimeout(300);

      // Select all and replace with updated JSON
      await pageA.keyboard.press('ControlOrMeta+a');
      await pageA.waitForTimeout(200);
      await pageA.keyboard.press('Backspace');
      await pageA.waitForTimeout(300);

      const updatedInputsSchema = '{\n  "query": {\n    "type": "string",\n    "description": "colab feature testing changing here User query to process",\n    "required": true\n  }\n}';
      await pageA.keyboard.insertText(updatedInputsSchema);
      await pageA.waitForTimeout(500);
      console.log('✅ Browser A: Inputs Schema updated');

      // Click the Save button inside the Interface panel
      const interfaceSaveBtn = pageA.getByRole('button', { name: /save/i })
        .filter({ has: pageA.locator('svg.lucide-save') });
      const saveVisible = await interfaceSaveBtn.first().isVisible({ timeout: 3_000 }).catch(() => false);
      if (saveVisible) {
        await interfaceSaveBtn.first().click();
      } else {
        // Fallback: find any Save button inside the Interface panel area
        const fallbackSave = pageA.getByRole('button', { name: /save/i }).last();
        await fallbackSave.click();
      }
      await pageA.waitForTimeout(3000);
      console.log('✅ Browser A: Interface saved');

      // Browser B: verify the updated text appears in Interface panel
      const collabTextOnB = pageB.getByText('colab feature testing', { exact: false }).first();
      await expect(collabTextOnB).toBeVisible({ timeout: 15_000 });
      console.log('✅ Browser B: Interface Inputs Schema change verified ("colab feature testing" visible)');

      // ══════════════════════════════════════════════════════════════════
      // 3) DISCOVERABILITY (Skills) — A adds a skill; B verifies
      //    (Clicking Discoverability button switches from Interface panel)
      // ══════════════════════════════════════════════════════════════════
      console.log('\n--- DISCOVERABILITY (SKILLS) TEST ---');

      // Browser B: switch to Discoverability panel (indigo radar icon)
      const discoverBtnB = pageB.locator('button').filter({ has: pageB.locator('svg.lucide-radar') }).first();
      await expect(discoverBtnB).toBeVisible({ timeout: 10_000 });
      await discoverBtnB.click();
      await pageB.waitForTimeout(1000);
      console.log('✅ Browser B: Discoverability panel opened');

      // Browser A: switch to Discoverability panel
      const discoverBtnA = pageA.locator('button').filter({ has: pageA.locator('svg.lucide-radar') }).first();
      await expect(discoverBtnA).toBeVisible({ timeout: 10_000 });
      await discoverBtnA.click();
      await pageA.waitForTimeout(1000);
      console.log('✅ Browser A: Discoverability panel opened');

      // Browser A: click "Add skill" button
      const addSkillBtn = pageA.getByRole('button', { name: /add skill/i })
        .or(pageA.locator('button[title="Add skill"]'));
      await expect(addSkillBtn.first()).toBeVisible({ timeout: 10_000 });
      await addSkillBtn.first().click();
      await pageA.waitForTimeout(1000);
      console.log('✅ Browser A: Add skill clicked');

      // Fill skill name (replace "Untitled skill")
      const skillNameInput = pageA.getByPlaceholder(/summarize documents/i)
        .or(pageA.locator('input[value="Untitled skill"]'))
        .first();
      await expect(skillNameInput).toBeVisible({ timeout: 10_000 });
      await skillNameInput.click({ clickCount: 3 });
      await skillNameInput.fill('CollabTestSkill');
      await pageA.waitForTimeout(300);
      console.log('✅ Browser A: Skill name set to "CollabTestSkill"');

      // Fill description
      const skillDescTextarea = pageA.getByPlaceholder(/describe the skill/i).first();
      await expect(skillDescTextarea).toBeVisible({ timeout: 10_000 });
      await skillDescTextarea.click();
      await skillDescTextarea.fill('collab');
      await pageA.waitForTimeout(300);
      console.log('✅ Browser A: Skill description set to "collab"');

      // Fill tags — type "test" and press Enter
      const tagsInput = pageA.getByPlaceholder(/enter tags/i)
        .or(pageA.getByPlaceholder(/tag1/i))
        .first();
      await expect(tagsInput).toBeVisible({ timeout: 10_000 });
      await tagsInput.click();
      await tagsInput.fill('test');
      await pageA.keyboard.press('Enter');
      await pageA.waitForTimeout(500);
      console.log('✅ Browser A: Tag "test" added');

      // Click "Add example" button
      const addExampleBtn = pageA.getByRole('button', { name: /add example/i })
        .or(pageA.locator('button[title="Add example"]'));
      await expect(addExampleBtn.first()).toBeVisible({ timeout: 10_000 });
      await addExampleBtn.first().click();
      await pageA.waitForTimeout(500);

      // Type "hello" in the example textarea
      const exampleTextarea = pageA.getByPlaceholder(/summarize the attached/i)
        .or(pageA.locator('textarea').last());
      await expect(exampleTextarea.last()).toBeVisible({ timeout: 10_000 });
      await exampleTextarea.last().click();
      await exampleTextarea.last().fill('hello');
      await pageA.waitForTimeout(1000);
      console.log('✅ Browser A: Example "hello" added');

      // Browser B: verify the skill name
      const skillNameOnB = pageB.getByText('CollabTestSkill', { exact: false }).first();
      await expect(skillNameOnB).toBeVisible({ timeout: 15_000 });
      console.log('✅ Browser B: Skill name "CollabTestSkill" verified');

      // Browser B: verify the description "collab"
      const skillDescOnB = pageB.getByText('collab', { exact: true })
        .or(pageB.locator('textarea').filter({ hasText: 'collab' }).first());
      await expect(skillDescOnB.first()).toBeVisible({ timeout: 15_000 });
      console.log('✅ Browser B: Skill description "collab" verified');

      // Browser B: verify the tag "test"
      const tagOnB = pageB.getByText('test', { exact: true }).first();
      await expect(tagOnB).toBeVisible({ timeout: 15_000 });
      console.log('✅ Browser B: Skill tag "test" verified');

      // Browser B: verify the example "hello"
      const exampleOnB = pageB.getByText('hello', { exact: false }).first();
      await expect(exampleOnB).toBeVisible({ timeout: 15_000 });
      console.log('✅ Browser B: Skill example "hello" verified');

      // ══════════════════════════════════════════════════════════════════
      // 4) PROPERTIES — Publish Channels: A unchecks Qi UI; B verifies
      //    (Click pencil icon to switch to Properties panel)
      // ══════════════════════════════════════════════════════════════════
      console.log('\n--- PROPERTIES: PUBLISH CHANNELS TEST ---');

      // Browser B: switch to Properties panel (pencil icon)
      const propertiesBtnB = pageB.locator('button').filter({ has: pageB.locator('svg.lucide-pencil') }).first();
      await expect(propertiesBtnB).toBeVisible({ timeout: 10_000 });
      await propertiesBtnB.click();
      await pageB.waitForTimeout(1000);
      await expect(pageB.getByText('Properties', { exact: false }).first()).toBeVisible({ timeout: 10_000 });
      console.log('✅ Browser B: Properties panel opened');

      // Browser A: switch to Properties panel
      const propertiesBtnA = pageA.locator('button').filter({ has: pageA.locator('svg.lucide-pencil') }).first();
      await expect(propertiesBtnA).toBeVisible({ timeout: 10_000 });
      await propertiesBtnA.click();
      await pageA.waitForTimeout(1000);
      await expect(pageA.getByText('Properties', { exact: false }).first()).toBeVisible({ timeout: 10_000 });
      console.log('✅ Browser A: Properties panel opened');

      // Browser A: scroll to Publish Channels and uncheck "Qi UI"
      const publishChannelsLabel = pageA.getByText('Publish Channels', { exact: false }).first();
      await publishChannelsLabel.scrollIntoViewIfNeeded();
      await pageA.waitForTimeout(500);

      // Find the Qi UI heading, go up to its card, and click the checkbox
      const qiUiHeadingA = pageA.getByRole('heading', { name: 'Qi UI' });
      await qiUiHeadingA.scrollIntoViewIfNeeded();
      await pageA.waitForTimeout(300);

      const qiUiCheckboxA = qiUiHeadingA.locator('..').locator('[role="checkbox"]').first();
      await expect(qiUiCheckboxA).toBeVisible({ timeout: 10_000 });
      await qiUiCheckboxA.click();
      await pageA.waitForTimeout(2000);
      console.log('✅ Browser A: Qi UI unchecked');

      // Browser B: scroll to Publish Channels and verify Qi UI is unchecked
      const publishChannelsB = pageB.getByText('Publish Channels', { exact: false }).first();
      await publishChannelsB.scrollIntoViewIfNeeded();
      await pageB.waitForTimeout(1000);

      const qiUiHeadingB = pageB.getByRole('heading', { name: 'Qi UI' });
      const qiUiCheckboxB = qiUiHeadingB.locator('..').locator('[role="checkbox"]').first();
      await expect(qiUiCheckboxB).toHaveAttribute('data-state', 'unchecked', { timeout: 15_000 });
      console.log('✅ Browser B: Qi UI checkbox verified as unchecked');

      // ══════════════════════════════════════════════════════════════════
      // 5) PROPERTIES — Access Rights: A adds an activity; B verifies
      // ══════════════════════════════════════════════════════════════════
      console.log('\n--- PROPERTIES: ACCESS RIGHTS TEST ---');

      // Browser A: scroll to Access Rights
      const accessRightsLabel = pageA.getByText('Access Rights', { exact: false }).first();
      await accessRightsLabel.scrollIntoViewIfNeeded();
      await pageA.waitForTimeout(500);

      // Click the dropdown chevron in the Access Rights input area
      const accessDropdownChevron = accessRightsLabel.locator('..').locator('..').locator('svg.lucide-chevron-down').first()
        .or(pageA.locator('.lucide-chevron-down').last());
      await expect(accessDropdownChevron).toBeVisible({ timeout: 10_000 });
      await accessDropdownChevron.click();
      await pageA.waitForTimeout(1000);

      // Type "zeroact" in the input to filter
      const accessInput = pageA.locator('input[placeholder=""]').last()
        .or(accessRightsLabel.locator('..').locator('..').locator('input').first());
      await accessInput.click();
      await accessInput.fill('zeroact');
      await pageA.waitForTimeout(1500);
      console.log('✅ Browser A: Typed "zeroact" in Access Rights dropdown');

      // Select the "zeroact" option from the dropdown
      const zeroactOption = pageA.getByText('zeroact', { exact: false })
        .filter({ hasText: /0099897|zeroact/i });
      await expect(zeroactOption.first()).toBeVisible({ timeout: 10_000 });
      await zeroactOption.first().click();
      await pageA.waitForTimeout(2000);
      console.log('✅ Browser A: "zeroact" activity selected');

      // Browser B: scroll to Access Rights and verify "zeroact" appears
      const accessRightsB = pageB.getByText('Access Rights', { exact: false }).first();
      await accessRightsB.scrollIntoViewIfNeeded();
      await pageB.waitForTimeout(1000);

      const zeroactOnB = pageB.getByText('zeroact', { exact: false }).first();
      await expect(zeroactOnB).toBeVisible({ timeout: 15_000 });
      console.log('✅ Browser B: "zeroact" activity verified in Access Rights');

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
