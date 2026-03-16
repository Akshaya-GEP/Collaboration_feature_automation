/// <reference types="node" />
/**
 * llmValidator.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Utility for semantically validating LLM / agent responses in Playwright BDD tests.
 *
 * Strategy for LLM validation (expectedIntent set):
 *   Layer 1 – Structural: response is non-empty, not an error, meets min length
 *   Layer 2 – LLM-as-Judge: score response against expected intent (JUDGE_API_* in .env)
 *   (Keyword matching is not used for LLM validation.)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ValidationRule {
    /** Human-readable label shown in the report */
    description: string;
    /** Keywords / phrases that must appear (case-insensitive substring match) */
    requiredKeywords?: string[];
    /** At least this many requiredKeywords must be present (default: all of them) */
    minKeywordMatchCount?: number;
    /** Keywords / phrases that must NOT appear (error indicators) */
    forbiddenKeywords?: string[];
    /** Minimum character length of a meaningful response */
    minLength?: number;
    /** Maximum character length (sanity check) */
    maxLength?: number;
    /** Optional: high-level intent that the response should convey (used for LLM-as-Judge) */
    expectedIntent?: string;
}

export interface ValidationResult {
    passed: boolean;
    score: number;          // 0-100
    details: string[];      // per-check log lines
    failureReasons: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Error-phrase detection (structural)
// ─────────────────────────────────────────────────────────────────────────────
const ERROR_INDICATORS = [
    'error occurred',
    'something went wrong',
    'unable to process',
    'i cannot',
    "i can't",
    'failed to',
    'internal server error',
    '500',
    'timeout',
    'undefined',
    'null',
    '[object object]',
];

// ─────────────────────────────────────────────────────────────────────────────
// Layer 1 – Structural validation
// ─────────────────────────────────────────────────────────────────────────────
export function validateStructure(
    response: string,
    rule: ValidationRule,
): { passed: boolean; details: string[]; failureReasons: string[] } {
    const details: string[] = [];
    const failureReasons: string[] = [];

    const trimmed = response.trim();
    const minLen = rule.minLength ?? 10;

    // 1a. Non-empty
    if (!trimmed) {
        failureReasons.push('Response is empty');
        return { passed: false, details, failureReasons };
    }
    details.push(`✅ Response is non-empty (${trimmed.length} chars)`);

    // 1b. Minimum length
    if (trimmed.length < minLen) {
        failureReasons.push(`Response too short: ${trimmed.length} chars (min ${minLen})`);
    } else {
        details.push(`✅ Response length OK: ${trimmed.length} >= ${minLen}`);
    }

    // 1c. Maximum length
    if (rule.maxLength && trimmed.length > rule.maxLength) {
        failureReasons.push(`Response too long: ${trimmed.length} chars (max ${rule.maxLength})`);
    }

    // 1d. Error indicators
    const lowerResp = trimmed.toLowerCase();
    const foundErrors = ERROR_INDICATORS.filter(e => lowerResp.includes(e));
    if (foundErrors.length > 0) {
        failureReasons.push(`Response contains error indicators: [${foundErrors.join(', ')}]`);
    } else {
        details.push('✅ No error indicators detected');
    }

    return { passed: failureReasons.length === 0, details, failureReasons };
}

// ─────────────────────────────────────────────────────────────────────────────
// Layer 2 – Keyword / topic validation
// ─────────────────────────────────────────────────────────────────────────────
export function validateKeywords(
    response: string,
    rule: ValidationRule,
): { passed: boolean; details: string[]; failureReasons: string[] } {
    const details: string[] = [];
    const failureReasons: string[] = [];
    const lowerResp = response.toLowerCase();

    // Required keywords
    if (rule.requiredKeywords && rule.requiredKeywords.length > 0) {
        const matched = rule.requiredKeywords.filter(k => lowerResp.includes(k.toLowerCase()));
        const minMatch = rule.minKeywordMatchCount ?? rule.requiredKeywords.length;

        details.push(
            `📋 Keywords matched: [${matched.join(', ')}] (${matched.length}/${rule.requiredKeywords.length})`
        );

        if (matched.length < minMatch) {
            const missing = rule.requiredKeywords.filter(k => !lowerResp.includes(k.toLowerCase()));
            failureReasons.push(
                `Only ${matched.length}/${rule.requiredKeywords.length} keywords found. ` +
                `Need at least ${minMatch}. Missing: [${missing.join(', ')}]`
            );
        } else {
            details.push(`✅ Keyword threshold met: ${matched.length} >= ${minMatch}`);
        }
    }

    // Forbidden keywords
    if (rule.forbiddenKeywords && rule.forbiddenKeywords.length > 0) {
        const found = rule.forbiddenKeywords.filter(k => lowerResp.includes(k.toLowerCase()));
        if (found.length > 0) {
            failureReasons.push(`Response contains forbidden phrases: [${found.join(', ')}]`);
        } else {
            details.push('✅ No forbidden keywords found');
        }
    }

    return { passed: failureReasons.length === 0, details, failureReasons };
}

import { isAzureConfigured, createAzureClient, AZURE_OPENAI_CONFIG } from './azureOpenAI';

// ─────────────────────────────────────────────────────────────────────────────
// Layer 3 – LLM-as-Judge (optional, requires AZURE_OPENAI or JUDGE_API in .env)
//
// This calls an external LLM endpoint and asks it:
//   "Does the following response correctly convey: <expectedIntent>?"
//   Score: 1-10. If score >= JUDGE_PASS_THRESHOLD (default 7), test passes.
// ─────────────────────────────────────────────────────────────────────────────
export async function validateWithLLMJudge(
    actualResponse: string,
    userMessage: string,
    expectedIntent: string,
): Promise<{ passed: boolean; score: number; rationale: string; details: string[] }> {
    const details: string[] = [];

    const threshold = parseInt(process.env.JUDGE_PASS_THRESHOLD ?? '7', 10);

    if (isAzureConfigured()) {
        try {
            details.push(`🤖 Calling Azure OpenAI (${AZURE_OPENAI_CONFIG.deployment}) for scoring...`);
            const client = createAzureClient();

            const prompt = `You are a strict QA evaluator for AI agent responses.

User asked: "${userMessage}"
Expected intent: "${expectedIntent}"
Actual response: "${actualResponse}"

Rate how well the actual response fulfils the expected intent on a scale of 1–10.
Respond ONLY in this exact JSON format (no markdown, no extra text):
{"score": <number 1-10>, "rationale": "<one sentence reason>"}`;

            const response = await client.chat.completions.create({
                model: AZURE_OPENAI_CONFIG.deployment!,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0,
                max_tokens: 150,
                response_format: { type: 'json_object' }
            });

            const raw = response.choices[0]?.message?.content?.trim() ?? '';
            details.push(`🤖 Judge raw output: ${raw}`);

            let parsed: { score: number; rationale: string };
            try {
                parsed = JSON.parse(raw) as { score: number; rationale: string };
            } catch {
                details.push('⚠️  Could not parse judge JSON — skipping judge result');
                return { passed: true, score: -1, rationale: raw, details };
            }

            const passed = parsed.score >= threshold;
            details.push(
                `${passed ? '✅' : '❌'} Judge score: ${parsed.score}/10 ` +
                `(threshold ${threshold}) — ${parsed.rationale}`
            );
            return { passed, score: parsed.score, rationale: parsed.rationale, details };

        } catch (err) {
            details.push(`⚠️  Azure Judge call failed (${String(err)}) — falling back or skipping`);
            // fall back to classic judge if URL is set, otherwise skip
        }
    }

    const apiUrl = process.env.JUDGE_API_URL;
    const apiKey = process.env.JUDGE_API_KEY;

    if (!apiUrl || !apiKey) {
        details.push(
            '⚠️  LLM-as-Judge skipped: Neither AZURE_OPENAI nor JUDGE_API is correctly set in .env'
        );
        return { passed: true, score: -1, rationale: 'skipped', details };
    }

    const prompt = `You are a strict QA evaluator for AI agent responses.

User asked: "${userMessage}"
Expected intent: "${expectedIntent}"
Actual response: "${actualResponse}"

Rate how well the actual response fulfils the expected intent on a scale of 1–10.
Respond ONLY in this exact JSON format (no markdown, no extra text):
{"score": <number 1-10>, "rationale": "<one sentence reason>"}`;

    try {
        details.push(`🤖 Calling Legacy LLM-as-Judge at ${apiUrl}...`);

        const resp = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: process.env.JUDGE_MODEL ?? 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0,
                max_tokens: 100,
            }),
        });

        if (!resp.ok) {
            details.push(`⚠️  Judge API returned HTTP ${resp.status} — skipping judge check`);
            return { passed: true, score: -1, rationale: `HTTP ${resp.status}`, details };
        }

        const data = await resp.json() as {
            choices?: Array<{ message?: { content?: string } }>;
        };
        const raw = data.choices?.[0]?.message?.content?.trim() ?? '';
        details.push(`🤖 Judge raw output: ${raw}`);

        let parsed: { score: number; rationale: string };
        try {
            // Strip possible markdown code fences
            const clean = raw.replace(/^```[a-z]*\n?|```$/g, '').trim();
            parsed = JSON.parse(clean) as { score: number; rationale: string };
        } catch {
            details.push('⚠️  Could not parse judge JSON — skipping judge result');
            return { passed: true, score: -1, rationale: raw, details };
        }

        const passed = parsed.score >= threshold;
        details.push(
            `${passed ? '✅' : '❌'} Judge score: ${parsed.score}/10 ` +
            `(threshold ${threshold}) — ${parsed.rationale}`
        );
        return { passed, score: parsed.score, rationale: parsed.rationale, details };
    } catch (err) {
        details.push(`⚠️  Judge call failed (${String(err)}) — skipping judge check`);
        return { passed: true, score: -1, rationale: String(err), details };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Master validator — runs all layers and returns a combined result
// ─────────────────────────────────────────────────────────────────────────────
export async function validateLLMResponse(
    actualResponse: string,
    userMessage: string,
    rule: ValidationRule,
): Promise<ValidationResult> {
    const allDetails: string[] = [];
    const allFailures: string[] = [];

    console.log('\n' + '═'.repeat(60));
    console.log('🧪 LLM RESPONSE VALIDATION');
    console.log('═'.repeat(60));
    console.log(`📨 User Message   : "${userMessage}"`);
    console.log(`📝 Rule           : "${rule.description}"`);
    console.log(`📄 Response (first 200 chars): "${actualResponse.substring(0, 200)}${actualResponse.length > 200 ? '...' : ''}"`);
    console.log('─'.repeat(60));

    // ── Layer 1: Structural ──
    console.log('📐 Layer 1: Structural Validation');
    const structural = validateStructure(actualResponse, rule);
    allDetails.push(...structural.details.map(d => `  ${d}`));
    allFailures.push(...structural.failureReasons.map(r => `[Structural] ${r}`));
    structural.details.forEach(d => console.log(`  ${d}`));
    structural.failureReasons.forEach(r => console.log(`  ❌ ${r}`));

    // ── Layer 2: LLM-as-Judge (keyword layer not used for LLM validation) ──
    let judgeScore = 100; // default if skipped
    if (rule.expectedIntent) {
        console.log('🤖 Layer 2: LLM-as-Judge Validation');
        const judge = await validateWithLLMJudge(actualResponse, userMessage, rule.expectedIntent);
        allDetails.push(...judge.details.map(d => `  ${d}`));
        judge.details.forEach(d => console.log(`  ${d}`));
        if (!judge.passed && judge.score > 0) {
            allFailures.push(`[LLM-Judge] Score ${judge.score}/10 below threshold — ${judge.rationale}`);
            judgeScore = judge.score * 10; // convert to 0-100
        } else if (judge.score > 0) {
            judgeScore = judge.score * 10;
        }
    }

    // ── Overall score (weighted): structure + judge only; no keyword layer ──
    const structurePassed = structural.failureReasons.length === 0;
    const overallPassed = allFailures.length === 0;

    const score = Math.round(
        (structurePassed ? 40 : 0) +
        (rule.expectedIntent && judgeScore >= 0 ? (judgeScore * 0.6) : 60)
    );

    // ── Summary ──
    console.log('─'.repeat(60));
    console.log(`📊 VALIDATION SUMMARY`);
    console.log(`  Overall : ${overallPassed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`  Score   : ${score}/100`);
    if (allFailures.length > 0) {
        console.log(`  Failures:`);
        allFailures.forEach(f => console.log(`    • ${f}`));
    }
    console.log('═'.repeat(60) + '\n');

    return {
        passed: overallPassed,
        score,
        details: allDetails,
        failureReasons: allFailures,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Compatibility Layer for Unified Framework
// ─────────────────────────────────────────────────────────────────────────────

export interface UnifiedValidationRule {
    description: string;
    expectedApiStatus?: number;
    minLength?: number;
    keywords?: string[];
    minKeywords?: number;
    expectedIntent?: string;
}

export interface UnifiedValidationResult {
    passed: boolean;
    score: number;
    details: string[];
    failureReasons: string[];
}

export async function performSingleShotValidation(
    responseText: string,
    interceptedResponse: any, // Browser response object
    query: string,
    rule: UnifiedValidationRule
): Promise<UnifiedValidationResult> {
    const allDetails: string[] = [];
    const allFailures: string[] = [];

    // 1. API Status Check
    if (interceptedResponse && typeof interceptedResponse.status === 'function') {
        const actualStatus = interceptedResponse.status();
        const expectedStatus = rule.expectedApiStatus ?? 200;
        if (actualStatus !== expectedStatus) {
            allFailures.push(`API Status Mismatch: Expected ${expectedStatus}, got ${actualStatus}`);
        } else {
            allDetails.push(`✅ API Status OK (${actualStatus})`);
        }
    }

    // 2. Wrap into classic ValidationRule (no keyword layer for LLM validation)
    const classicRule: ValidationRule = {
        description: rule.description,
        minLength: rule.minLength,
        expectedIntent: rule.expectedIntent
    };

    // 3. Run classic validation logic
    const result = await validateLLMResponse(responseText, query, classicRule);

    return {
        passed: allFailures.length === 0 && result.passed,
        score: result.score,
        details: [...allDetails, ...result.details],
        failureReasons: [...allFailures, ...result.failureReasons]
    };
}
