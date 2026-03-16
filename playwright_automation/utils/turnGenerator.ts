/**
 * turnGenerator.ts
 * Generates N conversation turns (userMessage, expectedResponse, matchType) using an LLM
 * (JUDGE_API_URL + JUDGE_API_KEY). Used for data-driven multi-turn validation.
 */

import type { TurnExpectation } from './agentResponseValidator';
import type { ChatSelectors } from './agentResponseValidator';

export interface GeneratedTurnsResult {
    turns: TurnExpectation[];
    selectors?: ChatSelectors;
}

const DEFAULT_PLACEHOLDER = 'Type your message here... (press enter to send)';
const DEFAULT_AGENT_SELECTOR = 'p.mb-0';

import { isAzureConfigured, createAzureClient, AZURE_OPENAI_CONFIG } from './azureOpenAI';

/**
 * Call the LLM to generate N conversation turns for the given scenario.
 * Uses AZURE_OPENAI (if configured) or JUDGE_API_URL, JUDGE_API_KEY, JUDGE_MODEL from env.
 * Returns turns in the same shape as conversation-turns JSON (TurnExpectation[]).
 */
export async function generateConversationTurns(
    scenarioDescription: string,
    numTurns: number,
    options?: { apiUrl?: string; apiKey?: string; model?: string }
): Promise<GeneratedTurnsResult> {
    const prompt = `You are a QA test designer. Generate exactly ${numTurns} conversation turns for testing an AI agent.

Scenario: ${scenarioDescription}

For each turn provide:
- userMessage: the exact user query (short, natural).
- expectedResponse: a phrase or sentence that the agent's response should contain or convey (for validation).
- matchType: one of "contains", "keywords", or "semantic". Use "contains" for simple substring checks, "semantic" when intent matters more than exact words.

Respond ONLY with a valid JSON object in this exact format (no markdown, no code fences, no extra text):
{"turns": [{"userMessage": "...", "expectedResponse": "...", "matchType": "contains"}, ...]}

Generate exactly ${numTurns} items in the "turns" array.`;

    let raw = '';

    if (isAzureConfigured()) {
        try {
            const client = createAzureClient();
            const response = await client.chat.completions.create({
                model: AZURE_OPENAI_CONFIG.deployment!,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3,
                max_tokens: 1500,
                response_format: { type: 'json_object' }
            });
            raw = response.choices[0]?.message?.content?.trim() ?? '';
        } catch (err) {
            console.error(`Azure turn generation failed: ${err}. Falling back to legacy API.`);
        }
    }

    if (!raw) {
        const apiUrl = options?.apiUrl ?? process.env.JUDGE_API_URL;
        const apiKey = options?.apiKey ?? process.env.JUDGE_API_KEY;
        const model = options?.model ?? process.env.JUDGE_MODEL ?? 'gpt-4o-mini';

        if (!apiUrl || !apiKey) {
            throw new Error(
                'Neither AZURE_OPENAI nor JUDGE_API_URL/KEY are set in .env to generate turns via LLM.'
            );
        }

        const resp = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3,
                max_tokens: 1500,
            }),
        });

        if (!resp.ok) {
            const text = await resp.text();
            throw new Error(`Turn generator API returned HTTP ${resp.status}: ${text}`);
        }

        const data = (await resp.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
        };
        raw = data.choices?.[0]?.message?.content?.trim() ?? '';
    }

    const clean = raw.replace(/^```[a-z]*\n?|```$/g, '').trim();
    let parsed: { turns: Array<{ userMessage: string; expectedResponse: string; matchType: string }> };
    try {
        parsed = JSON.parse(clean) as typeof parsed;
    } catch (e) {
        throw new Error(`Turn generator returned invalid JSON: ${raw.substring(0, 200)}`);
    }

    if (!Array.isArray(parsed.turns) || parsed.turns.length === 0) {
        throw new Error('Turn generator response must contain a non-empty "turns" array.');
    }

    const turns: TurnExpectation[] = parsed.turns.slice(0, numTurns).map((t) => ({
        userMessage: (t.userMessage ?? '').trim(),
        expectedResponse: (t.expectedResponse ?? '').trim(),
        matchType: normalizeMatchType(t.matchType),
    }));

    return {
        turns,
        selectors: {
            userQuerySelector: DEFAULT_PLACEHOLDER,
            agentResponseSelector: DEFAULT_AGENT_SELECTOR,
        },
    };
}

function normalizeMatchType(s: string): TurnExpectation['matchType'] {
    const v = (s ?? 'contains').trim().toLowerCase();
    if (v === 'exact' || v === 'contains' || v === 'keywords' || v === 'semantic') {
        return v;
    }
    return 'contains';
}

// ─────────────────────────────────────────────────────────────────────────────
// Generate expectedIntent for a user query using LLM (AZURE_OPENAI or JUDGE_API).
// Used when JSON contains only userMessage; intent is generated, then Judge scores.
// ─────────────────────────────────────────────────────────────────────────────

export async function generateExpectedIntent(
    userMessage: string,
    options?: { apiUrl?: string; apiKey?: string; model?: string; scenarioContext?: string }
): Promise<string> {
    const context = options?.scenarioContext ?? '';
    const prompt = `You are a QA evaluator. Given this user query to an AI agent, output in one short sentence what a correct response should convey (the expected intent). Be concise.

User query: "${userMessage}"
${context ? `Context: ${context}\n` : ''}
Respond with ONLY the expected intent sentence, no quotes, no JSON, no explanation.`;

    let intent = '';

    if (isAzureConfigured()) {
        try {
            const client = createAzureClient();
            const response = await client.chat.completions.create({
                model: AZURE_OPENAI_CONFIG.deployment!,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.2,
                max_tokens: 100,
            });
            intent = (response.choices[0]?.message?.content ?? '').trim().replace(/^["']|["']$/g, '');
        } catch (err) {
            console.error(`Azure intent generation failed: ${err}. Falling back to legacy API.`);
        }
    }

    if (!intent) {
        const apiUrl = options?.apiUrl ?? process.env.JUDGE_API_URL;
        const apiKey = options?.apiKey ?? process.env.JUDGE_API_KEY;
        const model = options?.model ?? process.env.JUDGE_MODEL ?? 'gpt-4o-mini';

        if (!apiUrl || !apiKey) {
            throw new Error(
                'Neither AZURE_OPENAI nor JUDGE_API_URL/KEY are set in .env to generate expected intent via LLM.'
            );
        }

        const resp = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.2,
                max_tokens: 80,
            }),
        });

        if (!resp.ok) {
            const text = await resp.text();
            throw new Error(`Intent generator API returned HTTP ${resp.status}: ${text}`);
        }

        const data = (await resp.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
        };
        intent = (data.choices?.[0]?.message?.content ?? '').trim().replace(/^["']|["']$/g, '');
    }

    if (!intent) {
        throw new Error('Intent generator returned empty expected intent.');
    }
    return intent;
}

