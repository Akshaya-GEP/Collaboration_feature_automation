import { When, Then, DataTable } from '@cucumber/cucumber';
import { expect, type Response } from '@playwright/test';
import assert from 'node:assert/strict';
import type { CustomWorld } from '../support/hooks';
import { performSingleShotValidation, type UnifiedValidationRule } from '../../utils/llmValidator';
import { ensureChatInterfaceReady, captureAgentResponse } from '../../utils/uiUtils';
import { waitForAiEvents } from '../../utils/workflowUtils';
import { generateExpectedIntent } from '../../utils/turnGenerator';
import { VALIDATION_RULES } from '../../utils/validationConfig';
import Logger from '../../utils/logger';
import CONFIG from '../../utils/config';

// Import Page Objects
import { OrchestrationHomePage } from '../../pages/orchestration/OrchestrationHomePage';
import { PropertiesPanel } from '../../pages/orchestration/PropertiesPanel';
import { JsonViewPanel } from '../../pages/orchestration/JsonViewPanel';
import { GraphEditorPage } from '../../pages/orchestration/GraphEditorPage';

// ─────────────────────────────────────────────────────────────────────────────
// UNIFIED AGENT CREATION (JSON-BASED)
// ─────────────────────────────────────────────────────────────────────────────

When('I create a JSON agent named {string} with description {string} using {string}',
    async function (this: CustomWorld, agentName: string, description: string, jsonPath: string) {
        assert(this.page, 'World.page was not initialized');
        const fs = await import('node:fs/promises');
        const path = await import('node:path');

        Logger.step(`Creating unified JSON agent: ${agentName}`);

        const orchestrationHome = new OrchestrationHomePage(this.page);
        const propertiesPanel = new PropertiesPanel(this.page);
        const jsonView = new JsonViewPanel(this.page);

        // 1. Navigation & Start
        await orchestrationHome.startGraphOrchestration();

        // 2. Set Properties
        await propertiesPanel.fillProperties({
            name: agentName,
            description: description,
            publishChannel: 'Qi UI', // Default
            activityCodes: 'Home' // Default
        });
        await propertiesPanel.closePanel();
        await this.page.waitForTimeout(1000);

        // 3. Paste JSON
        Logger.info(`Pasting JSON from: ${jsonPath}`);
        const fullPath = path.resolve(process.cwd(), jsonPath);
        const jsonContent = await fs.readFile(fullPath, 'utf-8');
        this.usedJsonContent = jsonContent; // Store for report on failure

        await jsonView.open();
        await jsonView.pasteJson(jsonContent);
        await jsonView.clickSyncChanges();
        await jsonView.close();

        // 4. Final Save (on canvas)
        const saveBtn = this.page.getByRole('button', { name: /^Save$/i }).first();
        if (await saveBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await saveBtn.click();
            await this.page.waitForTimeout(2000);
        }

        Logger.success(`Agent "${agentName}" created and synced.`);
    });

// ─────────────────────────────────────────────────────────────────────────────
// UNIFIED RUN & VALIDATE (SINGLE-SHOT)
// ─────────────────────────────────────────────────────────────────────────────

Then('the agent should correctly answer the query {string} with these rules:',
    async function (this: CustomWorld, query: string, dataTable: DataTable) {
        assert(this.page, 'World.page was not initialized');

        // 1. Setup Interceptor
        const responsePromise = this.page.waitForResponse(
            (response: Response) => {
                const url = response.url().toLowerCase();
                // Match chat runtime or orchestration execution endpoints
                return (url.includes('/api/') || url.includes('/run') || url.includes('/stream') || url.includes('workflow-engine') || url.includes('chat-completion'))
                    && !/\.(js|css|png|jpg|svg|html|woff|json$)/.test(url);
            },
            { timeout: CONFIG.TIMEOUTS.LLM_RESPONSE }
        );

        // 2. Ensure Chat Interface is Visible
        const graphEditor = new GraphEditorPage(this.page);
        await graphEditor.openChat();

        // 3. Send Message
        Logger.step(`Single-Shot Execution for query: "${query}"`);
        const chatInput = graphEditor.chatInput;
        await expect(chatInput).toBeVisible({ timeout: 15_000 });
        await chatInput.click();
        await chatInput.fill(query);
        await chatInput.press('Enter');

        this.aiEventsCount = await waitForAiEvents(this.page, this.aiEventsCount).catch(() => this.aiEventsCount);

        // 4. Capture Response & Intercepted API
        const interceptedResponse = await responsePromise;
        const responseText = await captureAgentResponse(this.page);

        // 5. Parse Validation Rules
        const rows = dataTable.rowsHash();
        const rule: UnifiedValidationRule = {
            description: `Verify: ${query}`,
            minLength: parseInt(rows['minLength'] || '10', 10),
            expectedIntent: rows['expectedIntent'] || undefined,
            expectedApiStatus: parseInt(rows['status'] || '200', 10),
        };

        // 6. SINGLE-SHOT VALIDATION (API + Structural + Keywords + Semantic)
        const result = await performSingleShotValidation(responseText, interceptedResponse, query, rule);

        if (!result.passed) {
            throw new Error(`Single-Shot Validation FAILED for query "${query}".\nFailure Reasons: ${result.failureReasons.join(' | ')}`);
        }
    });

// ─────────────────────────────────────────────────────────────────────────────
// Single-shot validation without rules table: rules from validationConfig,
// expectedIntent generated by LLM (JUDGE_API_*). No table in scenario.
// ─────────────────────────────────────────────────────────────────────────────

Then('the agent should correctly answer the query {string}', async function (this: CustomWorld, query: string) {
    assert(this.page, 'World.page was not initialized');

    const responsePromise = this.page.waitForResponse(
        (response: Response) => {
            const url = response.url().toLowerCase();
            return (url.includes('/api/') || url.includes('/run') || url.includes('/stream') || url.includes('workflow-engine') || url.includes('chat-completion'))
                && !/\.(js|css|png|jpg|svg|html|woff|json$)/.test(url);
        },
        { timeout: CONFIG.TIMEOUTS.LLM_RESPONSE }
    );

    const graphEditor = new GraphEditorPage(this.page);
    await graphEditor.openChat();

    Logger.step(`Single-Shot (no table): query "${query}", generating expectedIntent via LLM`);
    const expectedIntent = await generateExpectedIntent(query);

    const chatInput = graphEditor.chatInput;
    await expect(chatInput).toBeVisible({ timeout: 15_000 });
    await chatInput.click();
    await chatInput.fill(query);
    await chatInput.press('Enter');

    this.aiEventsCount = await waitForAiEvents(this.page, this.aiEventsCount).catch(() => this.aiEventsCount);

    const interceptedResponse = await responsePromise;
    const responseText = await captureAgentResponse(this.page);

    const rule: UnifiedValidationRule = {
        description: `Verify: ${query}`,
        minLength: VALIDATION_RULES.minLength,
        expectedIntent,
        expectedApiStatus: 200,
    };

    const result = await performSingleShotValidation(responseText, interceptedResponse, query, rule);
    if (!result.passed) {
        throw new Error(`Single-Shot Validation FAILED for query "${query}".\nFailure Reasons: ${result.failureReasons.join(' | ')}`);
    }
});
