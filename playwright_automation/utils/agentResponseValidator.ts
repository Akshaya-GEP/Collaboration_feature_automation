/**
 * agentResponseValidator.ts
 * Multi-turn agent conversation validator with configurable user-query and
 * agent-response UI selectors. Waits for agent response before validating.
 */

import type { Page, Response } from '@playwright/test';
import { validateLLMResponse, type ValidationRule } from './llmValidator';
import Logger from './logger';
import CONFIG from './config';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type MatchType = 'exact' | 'contains' | 'keywords' | 'semantic';

export interface ChatSelectors {
    /** Selector or placeholder text for the chat input (e.g. "Type your message here..." or "input[placeholder*='message']"). */
    userQuerySelector?: string;
    /** Selector for the agent response element; last matching element is used (e.g. "p.mb-0"). */
    agentResponseSelector?: string;
}

export interface TurnExpectation {
    userMessage: string;
    expectedResponse: string;
    matchType: MatchType;
    /** Optional for semantic: intent description for LLM-as-Judge. Defaults to expectedResponse. */
    expectedIntent?: string;
    /** Optional for keywords: min number of keywords that must match (default 1). */
    minKeywords?: number;
}

export interface SingleTurnResult {
    passed: boolean;
    turnIndex: number;
    userMessage: string;
    expectedResponse: string;
    actualResponse: string;
    failureReason?: string;
    /** Validation score (0-100) when semantic/LLM-judge was used. */
    score?: number;
}

export interface MultiTurnResult {
    passed: boolean;
    turnIndex?: number;
    results: SingleTurnResult[];
}

// Default selectors: chat input by placeholder, agent response p.mb-0 then fallbacks
const DEFAULT_CHAT_INPUT_PLACEHOLDER = "Type your message here... (press enter to send)";
const DEFAULT_AGENT_RESPONSE_SELECTORS = [
    'p.mb-0',
    '[class*="assistant"][class*="message"]',
    '[data-role="assistant"]',
    '[class*="chat-bubble"]:not([class*="user"])',
    '[class*="message"]:not([class*="user"])',
];

const TYPING_INDICATOR_SELECTOR =
    '[class*="typing"],[class*="loading"],[class*="thinking"],[class*="spinner"],[aria-label*="loading"]';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers: wait for response, get agent response text
// ─────────────────────────────────────────────────────────────────────────────

async function waitForAgentResponseReady(page: Page, timeoutMs: number): Promise<void> {
    const typingIndicator = page.locator(TYPING_INDICATOR_SELECTOR);
    await typingIndicator.first().waitFor({ state: 'hidden', timeout: timeoutMs }).catch(() => { });
    await page.waitForTimeout(1500);
}

/**
 * Resolve chat input locator. If userQuerySelector looks like a CSS selector (e.g. "input", "#id", ".class", "[attr]"),
 * use page.locator(); otherwise treat as placeholder text and use getByPlaceholder.
 */
function getChatInputLocator(page: Page, selectors?: ChatSelectors) {
    const raw = selectors?.userQuerySelector?.trim();
    const looksLikeCssSelector =
        raw &&
        (raw.startsWith('#') ||
            raw.startsWith('.') ||
            raw.startsWith('[') ||
            raw.startsWith('>>') ||
            /^[a-zA-Z][a-zA-Z0-9-]*$/.test(raw) ||
            (raw.length <= 30 && !raw.includes('...') && !raw.includes('(')));
    if (raw && looksLikeCssSelector) {
        return page.locator(raw).first();
    }
    const placeholder = raw?.replace(/^["']|["']$/g, '') || DEFAULT_CHAT_INPUT_PLACEHOLDER;
    return page.getByPlaceholder(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
}

/**
 * Get text from last agent response element. Tries custom selector first, then fallbacks. Uses innerText when possible for HTML content (e.g. p.mb-0 with <strong>).
 */
async function getLastAgentResponseText(page: Page, selectors?: ChatSelectors): Promise<string> {
    const custom = selectors?.agentResponseSelector?.trim();
    const list = custom ? [custom, ...DEFAULT_AGENT_RESPONSE_SELECTORS.filter(s => s !== custom)] : DEFAULT_AGENT_RESPONSE_SELECTORS;

    for (const selector of list) {
        const locator = page.locator(selector);
        const count = await locator.count().catch(() => 0);
        if (count === 0) continue;

        const lastEl = locator.last();
        await lastEl.waitFor({ state: 'visible', timeout: 5000 }).catch(() => { });
        const text = await lastEl.evaluate((el: HTMLElement) => (el as HTMLElement).innerText ?? el.textContent ?? '').catch(() => '');
        const trimmed = (text ?? '').trim().replace(/\d{1,2}:\d{2}\s*(AM|PM)?$/i, '').trim();
        if (trimmed.length >= 2) {
            Logger.info(`Agent response captured (${selector}): "${trimmed.substring(0, 80)}..."`);
            return trimmed;
        }
    }

    throw new Error('Could not read agent response from any known selector. Ensure the agent has responded and selectors match your UI.');
}

// ─────────────────────────────────────────────────────────────────────────────
// Single-turn validation by matchType
// ─────────────────────────────────────────────────────────────────────────────

function validateByMatchType(
    actualResponse: string,
    expectedResponse: string,
    matchType: MatchType,
    userMessage: string,
    options: { expectedIntent?: string; minKeywords?: number }
): { passed: boolean; failureReason?: string } {
    const actual = actualResponse.trim();
    const expected = expectedResponse.trim();
    const lowerActual = actual.toLowerCase();
    const lowerExpected = expected.toLowerCase();

    switch (matchType) {
        case 'exact':
            if (actual !== expected) {
                return { passed: false, failureReason: `Expected exact match "${expected}", got "${actual.substring(0, 200)}${actual.length > 200 ? '...' : ''}"` };
            }
            return { passed: true };

        case 'contains':
            if (!lowerActual.includes(lowerExpected)) {
                return { passed: false, failureReason: `Expected response to contain "${expected}", got "${actual.substring(0, 200)}${actual.length > 200 ? '...' : ''}"` };
            }
            return { passed: true };

        case 'keywords': {
            const keywords = expected.split(',').map(k => k.trim()).filter(Boolean);
            const minMatch = options.minKeywords ?? 1;
            const matched = keywords.filter(k => lowerActual.includes(k.toLowerCase()));
            if (matched.length < minMatch) {
                return {
                    passed: false,
                    failureReason: `Expected at least ${minMatch} of [${keywords.join(', ')}]; found ${matched.length}: [${matched.join(', ')}]. Response: "${actual.substring(0, 150)}..."`,
                };
            }
            return { passed: true };
        }

        case 'semantic':
            // Handled in validateSingleTurn via validateLLMResponse
            return { passed: true };

        default:
            return { passed: false, failureReason: `Unknown matchType: ${matchType}` };
    }
}

/**
 * Validate a single turn: send user message, wait for agent response, then validate by matchType.
 * Uses semantic validation (validateLLMResponse) when matchType is 'semantic'.
 */
export async function validateSingleTurn(
    page: Page,
    turn: TurnExpectation,
    turnIndex: number,
    selectors?: ChatSelectors,
    options?: { timeoutMs?: number }
): Promise<SingleTurnResult> {
    const timeoutMs = options?.timeoutMs ?? CONFIG.TIMEOUTS.LLM_RESPONSE;

    // 1. Setup API Interceptor: listens for chat runtime or streaming endpoints
    const responsePromise = page.waitForResponse(
        (response: Response) => {
            const url = response.url().toLowerCase();
            return (url.includes('/api/') || url.includes('/run') || url.includes('/stream') || url.includes('workflow-engine') || url.includes('chat-completion'))
                && !/\.(js|css|png|jpg|svg|html|woff|json$)/.test(url);
        },
        { timeout: timeoutMs }
    ).catch(() => null);

    const chatInput = getChatInputLocator(page, selectors);

    await chatInput.waitFor({ state: 'visible', timeout: 15_000 });
    await chatInput.click();
    await chatInput.fill(turn.userMessage);
    await chatInput.press('Enter');

    // 2. Wait for BOTH: The backend API response and UI readiness
    const interceptedResponse = await responsePromise;
    await waitForAgentResponseReady(page, timeoutMs);
    await page.waitForTimeout(2000);

    // 3. Optional: Check API status
    let apiFailureReason = '';
    if (interceptedResponse && interceptedResponse.status() !== 200) {
        apiFailureReason = `API Mismatch: Response returned status ${interceptedResponse.status()}`;
    }

    const actualResponse = await getLastAgentResponseText(page, selectors);

    if (turn.matchType === 'semantic') {
        const rule: ValidationRule = {
            description: `Turn ${turnIndex + 1}: ${turn.userMessage}`,
            expectedIntent: turn.expectedIntent ?? turn.expectedResponse,
            minLength: 5,
        };
        const result = await validateLLMResponse(actualResponse, turn.userMessage, rule);

        // Combine API failure and Validator failures
        const allFailures = [apiFailureReason, ...(result.failureReasons || [])].filter(Boolean);
        const passed = result.passed && !apiFailureReason;

        return {
            passed,
            turnIndex,
            userMessage: turn.userMessage,
            expectedResponse: turn.expectedResponse,
            actualResponse,
            failureReason: allFailures.length > 0 ? allFailures.join('; ') : undefined,
            score: result.score,
        };
    }

    const { passed: matchPassed, failureReason: matchFailureReason } = validateByMatchType(
        actualResponse,
        turn.expectedResponse,
        turn.matchType,
        turn.userMessage,
        { expectedIntent: turn.expectedIntent, minKeywords: turn.minKeywords }
    );

    const allFailures = [apiFailureReason, matchFailureReason].filter(Boolean);
    const passed = matchPassed && !apiFailureReason;

    return {
        passed,
        turnIndex,
        userMessage: turn.userMessage,
        expectedResponse: turn.expectedResponse,
        actualResponse,
        failureReason: allFailures.length > 0 ? allFailures.join('; ') : undefined,
    };
}

/**
 * Run N turns: for each turn send user message, wait for agent response, validate.
 * Stops on first failure and returns results.
 */
export async function runMultiTurnConversationAndValidate(
    page: Page,
    turns: TurnExpectation[],
    selectors?: ChatSelectors,
    options?: { timeoutMs?: number }
): Promise<MultiTurnResult> {
    const results: SingleTurnResult[] = [];
    const timeoutMs = options?.timeoutMs ?? CONFIG.TIMEOUTS.LLM_RESPONSE;

    for (let i = 0; i < turns.length; i++) {
        Logger.step(`Turn ${i + 1}/${turns.length}: "${turns[i].userMessage}"`);
        const result = await validateSingleTurn(page, turns[i], i, selectors, { timeoutMs });
        results.push(result);
        if (!result.passed) {
            return { passed: false, turnIndex: i, results };
        }
    }

    return { passed: true, results };
}
