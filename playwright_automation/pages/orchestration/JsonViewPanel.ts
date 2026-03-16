import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Page object for the JSON View panel.
 * Flow: Open (load JSON editor) → paste JSON inside editor → click Sync changes → close. Caller saves after.
 */
export class JsonViewPanel {
  constructor(private readonly page: Page) { }

  private get jsonViewButton() {
    return this.page
      .locator('[title="JSON View"]')
      .or(this.page.getByTitle('JSON View'))
      .or(this.page.locator('button').filter({ has: this.page.locator('svg.lucide-braces') }).first());
  }

  private get syncChangesButton() {
    return this.page.getByRole('button', { name: /sync changes/i });
  }

  private get editorArea() {
    return this.page
      .locator('.view-lines, .monaco-editor, [class*="editor"], [class*="json-editor"]')
      .first()
      .or(this.page.locator('pre').last());
  }

  private get closeButton() {
    return this.page
      .locator('[aria-label="close"], button:has-text("×")')
      .or(this.page.getByRole('button', { name: /close/i }).filter({ hasText: /^[×x]$/i }))
      .or(this.page.locator('button').filter({ hasText: '×' }));
  }

  async open() {
    console.log('Step: Opening JSON View panel...');
    await this.page.waitForTimeout(1000); // Wait for canvas to settle

    const btn = this.jsonViewButton.first();
    await expect(btn).toBeVisible({ timeout: 15_000 });
    await btn.scrollIntoViewIfNeeded();
    // Use a small delay before clicking to ensure it's not a race condition
    await this.page.waitForTimeout(500);
    await btn.click({ force: true });

    console.log('Waiting for JSON editor content to appear...');
    await expect(
      this.page.getByText(/JSON View/i).first()
    ).toBeVisible({ timeout: 15_000 });

    await this.page.waitForTimeout(2000);
    await this.waitForEditorLoaded();
    console.log('✅ JSON editor loaded and ready for paste');
  }

  /** Wait for the JSON editor content area to be visible so paste goes inside the editor. */
  private async waitForEditorLoaded(): Promise<void> {
    const editor = this.page.locator('.monaco-editor, .view-lines, [class*="json-editor"]').first();
    await expect(editor).toBeVisible({ timeout: 10_000 });
    await this.page.waitForTimeout(500);
  }

  async pasteJson(jsonContent: string) {
    console.log('Step: Pasting JSON inside the editor...');

    await expect(this.editorArea).toBeVisible({ timeout: 10_000 });
    await this.editorArea.scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(300);
    await this.editorArea.click({ force: true });
    await this.page.waitForTimeout(1000);

    // Select all and Clear
    console.log('Clearing existing editor content...');
    await this.page.keyboard.press('ControlOrMeta+a');
    await this.page.keyboard.press('Backspace');
    await this.page.waitForTimeout(1000);

    await this.editorArea.click({ force: true });
    await this.page.waitForTimeout(500);

    // Paste: try clipboard first, fallback to Monaco textarea fill or type
    console.log('Executing paste action...');
    try {
      await this.page.evaluate(async (text) => {
        await navigator.clipboard.writeText(text);
      }, jsonContent);
      await this.page.keyboard.press('ControlOrMeta+v');
    } catch (e) {
      console.log('Clipboard API failed/blocked, using direct fill fallback...');
      const monacoTextArea = this.page.locator('textarea.monaco-mouse-cursor-text').first();
      if (await monacoTextArea.isVisible({ timeout: 2000 }).catch(() => false)) {
        await monacoTextArea.focus();
        await this.page.waitForTimeout(200);
        await monacoTextArea.fill(jsonContent);
      } else {
        await this.page.keyboard.type(jsonContent, { delay: 0 });
      }
    }

    await this.page.waitForTimeout(2000); // Critical: wait for model update

    const isValid = await this.page.getByText(/Valid JSON/i).isVisible({ timeout: 5_000 }).catch(() => false);
    if (isValid) {
      console.log('✅ JSON content validated by UI');
    } else {
      console.log('⚠️ "Valid JSON" indicator not visible. Checking if content is present...');
      const lineCount = await this.page.locator('.view-line').count();
      if (lineCount > 1) {
        console.log(`✅ Lines found in editor (${lineCount}), proceeding.`);
      } else {
        console.error('❌ Editor appears empty after paste attempt!');
      }
    }
  }

  async clickSyncChanges() {
    console.log('Step: Clicking Sync changes...');
    const btn = this.syncChangesButton.first();
    await expect(btn).toBeVisible({ timeout: 15_000 });
    await btn.scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(300);
    await btn.click({ force: true });
    await this.page.waitForTimeout(4000); // Wait for graph to rebuild
    console.log('✅ Changes synced');
  }

  async close() {
    console.log('Step: Closing JSON editor...');
    const closeBtn = this.closeButton.first();
    if (await closeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await closeBtn.click();
    } else {
      await this.page.keyboard.press('Escape');
    }
    await this.page.waitForTimeout(1000);
    console.log('✅ JSON panel closed');
  }
}
