import { When } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { CustomWorld } from '../../support/hooks';
import { JsonViewPanel } from '../../../pages/orchestration/JsonViewPanel';

// ──────────────────────────────────────────────────────────────────────────────
// JSON View / JSON Editor steps
// ──────────────────────────────────────────────────────────────────────────────

When('I open the JSON editor', async function (this: CustomWorld) {
    assert(this.page, 'World.page was not initialized');
    const jsonPanel = new JsonViewPanel(this.page);
    await jsonPanel.open();
});

When('I paste the agent JSON from {string}', async function (this: CustomWorld, filePath: string) {
    assert(this.page, 'World.page was not initialized');
    const baseDir = process.cwd().includes('playwright_automation')
        ? process.cwd()
        : path.join(process.cwd(), 'playwright_automation');
    const resolvedPath = path.resolve(baseDir, filePath);
    console.log(`Reading agent JSON from: ${resolvedPath}`);
    const jsonContent = fs.readFileSync(resolvedPath, 'utf-8');
    
    // Store JSON for attachment in report on failure
    this.usedJsonContent = jsonContent;
    
    const jsonText = jsonContent.replace(/__comment.*?\n/g, '').trim();

    const jsonPanel = new JsonViewPanel(this.page);
    await jsonPanel.pasteJson(jsonText);
});

When('I click Sync changes', async function (this: CustomWorld) {
    assert(this.page, 'World.page was not initialized');
    const jsonPanel = new JsonViewPanel(this.page);
    await jsonPanel.clickSyncChanges();
});

When('I close the JSON editor', async function (this: CustomWorld) {
    assert(this.page, 'World.page was not initialized');
    const jsonPanel = new JsonViewPanel(this.page);
    await jsonPanel.close();
});
