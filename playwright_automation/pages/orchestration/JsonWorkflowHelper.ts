import * as fs from 'fs';
import * as path from 'path';
import type { Page } from '@playwright/test';
import { JsonViewPanel } from './JsonViewPanel';

/**
 * 1. Load the JSON editor (open and wait until loaded)
 * 2. Paste the JSON inside the JSON editor
 * 3. Click Sync changes
 * 4. Close the JSON editor
 * Caller must save the workflow after this returns.
 */
export async function pasteWorkflowJsonFromBdd(page: Page, bddJsonPath: string): Promise<void> {
  const jsonText = readBddJson(bddJsonPath);
  const jsonPanel = new JsonViewPanel(page);

  await jsonPanel.open();
  await allowClipboardIfRequested(page);
  await jsonPanel.pasteJson(jsonText);
  await allowClipboardIfRequested(page);
  await jsonPanel.clickSyncChanges();
  await jsonPanel.close();
}

/** If the "clipboard access" permission dialog appears, click Allow. */
async function allowClipboardIfRequested(page: Page): Promise<void> {
  const allowBtn = page.getByRole('button', { name: /allow/i });
  if (await allowBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await allowBtn.click();
    await page.waitForTimeout(500);
  }
}

/** Same path resolution as JsonAgent.steps.ts: baseDir from cwd, then path.resolve(baseDir, filePath). */
function readBddJson(filePath: string): string {
  const baseDir = process.cwd().includes('playwright_automation')
    ? process.cwd()
    : path.join(process.cwd(), 'playwright_automation');
  const resolvedPath = path.resolve(baseDir, filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`JSON not found: ${resolvedPath}`);
  }
  const jsonContent = fs.readFileSync(resolvedPath, 'utf-8');
  return jsonContent.replace(/__comment.*?\n/g, '').trim();
}
