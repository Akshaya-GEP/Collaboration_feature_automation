import { When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import assert from 'node:assert/strict';
import type { CustomWorld } from '../../support/hooks';

// ──────────────────────────────────────────────────────────────────────────────
// Run Validation – intercept the chat API response and assert HTTP 200
//
// Strategy:
//   1. "I start intercepting the chat API response"  → registers a
//      page.waitForResponse() promise BEFORE the message is sent
//   2. "I type and send message ... in the chat"     → (reuses AgentCreation step)
//   3. "the chat API response status should be 200"  → awaits the promise and asserts
//
// The intercepted URL patterns try to cover common GEP QI Studio chat endpoints.
// If the real endpoint differs, add it to CHAT_API_PATTERNS below.
// ──────────────────────────────────────────────────────────────────────────────

/**
 * URL patterns (substring match) for the agent chat API.
 * We accept ANY response whose URL contains at least one of these strings.
 */
const CHAT_API_PATTERNS = [
    '/chat',
    '/message',
    '/conversation',
    '/invoke',
    '/run',
    '/stream',
    '/completions',
    '/agent/execute',
    '/agents/chat',
];

/**
 * Returns true if the given URL is likely the chat API call we care about.
 * Ignores static assets, HTML pages, and health-checks.
 */
function isChatApiUrl(url: string): boolean {
    const lower = url.toLowerCase();
    // Must look like an API call (contains api/v or our chat patterns)
    const isApi = lower.includes('/api/') || CHAT_API_PATTERNS.some(p => lower.includes(p));
    // Must NOT be a static asset or page navigation
    const isAsset = /\.(js|css|png|jpg|svg|ico|html|woff2?|ttf)(\?|$)/.test(lower);
    return isApi && !isAsset;
}

// ─── CustomWorld extension ──────────────────────────────────────────────────
// We extend CustomWorld at runtime to hold the pending response promise.
// TypeScript note: we use `(this as any)` to avoid touching the shared hooks.ts.

When('I start intercepting the chat API response', async function (this: CustomWorld) {
    assert(this.page, 'World.page was not initialized');

    console.log('🔍 Setting up API response interceptor before sending the chat message...');

    /**
     * page.waitForResponse() must be set up BEFORE the action that triggers
     * the network request.  We store the Promise on `this` so the Then-step
     * can await it after the message is sent.
     */
    const responsePromise = this.page.waitForResponse(
        (response) => {
            const url = response.url();
            const matched = isChatApiUrl(url);
            if (matched) {
                console.log(`📡 Intercepted API call → ${response.request().method()} ${url}`);
            }
            return matched;
        },
        { timeout: 90_000 }   // AI inference can be slow – allow up to 90 s
    );

    // Attach the promise to `this` so the Then-step can retrieve it
    (this as any)._chatApiResponsePromise = responsePromise;

    console.log('✅ Interceptor registered. Waiting for chat message to be sent...');
});

Then('the chat API response status should be 200', async function (this: CustomWorld) {
    assert(this.page, 'World.page was not initialized');

    const responsePromise: Promise<import('@playwright/test').Response> | undefined =
        (this as any)._chatApiResponsePromise;

    if (!responsePromise) {
        throw new Error(
            'No interceptor promise found. ' +
            'Make sure "I start intercepting the chat API response" runs BEFORE sending the message.'
        );
    }

    console.log('⏳ Awaiting the intercepted chat API response...');

    let response: import('@playwright/test').Response;
    try {
        response = await responsePromise;
    } catch (err) {
        throw new Error(
            `Chat API response was not received within the timeout.\n` +
            `Possible reasons:\n` +
            `  • The URL pattern did not match the real endpoint (see CHAT_API_PATTERNS in RunValidation.steps.ts)\n` +
            `  • The agent took too long to respond\n` +
            `Original error: ${String(err)}`
        );
    }

    const status = response.status();
    const url = response.url();
    const method = response.request().method();

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 API VALIDATION RESULT`);
    console.log(`${'='.repeat(60)}`);
    console.log(`  Method  : ${method}`);
    console.log(`  URL     : ${url}`);
    console.log(`  Status  : ${status} ${status === 200 ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`${'='.repeat(60)}\n`);

    // The actual assertion – fails the Cucumber step if status !== 200
    expect(
        status,
        `Expected chat API response status to be 200 but got ${status}.\nURL: ${url}`
    ).toBe(200);

    console.log('✅ API response status is 200 — Run validation PASSED!');
});
