import type { Page } from '@playwright/test';
import CONFIG from './config';

const DEFAULT_PILL_PATTERN = /AI Events \(\d+\)/i;

/**
 * Get the AI events pill regex from config or env.
 * Returns null if explicitly disabled (empty string in env).
 */
function getPillPattern(): RegExp | null {
    const raw = (process.env.AI_EVENTS_PILL_REGEX ?? CONFIG.AI_EVENTS_PILL_REGEX ?? '').trim();
    if (raw === 'off' || raw === 'none') {
        return null;
    }
    if (raw === '') {
        return DEFAULT_PILL_PATTERN;
    }
    try {
        const match = raw.match(/^\/(.*)\/(i?)$/);
        if (match) {
            return new RegExp(match[1], match[2] || '');
        }
        return new RegExp(raw, 'i');
    } catch {
        return DEFAULT_PILL_PATTERN;
    }
}

/**
 * Wait for AI events counter to update, or for network to settle.
 * - If the app shows an "AI Events (N)"-style pill (configurable via AI_EVENTS_PILL_REGEX),
 *   polls until the count increases from previousCount.
 * - If no pill is found within ~3s, falls back to networkidle so the helper is still
 *   useful for "wait for AI/network to settle" when the app has no pill.
 */
export async function waitForAiEvents(
    page: Page,
    previousCount: number | null = null,
    timeoutMs?: number,
    options?: { pillPattern?: RegExp | null },
): Promise<number> {
    const effectiveTimeout = timeoutMs ?? CONFIG.AI_EVENTS_TIMEOUT_MS ?? 180_000;
    const pillPattern = options?.pillPattern !== undefined ? options.pillPattern : getPillPattern();

    if (pillPattern === null) {
        await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
        return previousCount ?? 0;
    }

    const pill = page.getByText(pillPattern).first();
    const isAiPage = await pill.isVisible({ timeout: 3000 }).catch(() => false);

    if (!isAiPage) {
        await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
        return previousCount ?? 0;
    }

    const start = Date.now();
    while (Date.now() - start < effectiveTimeout) {
        const isVisible = await pill.isVisible({ timeout: 2000 }).catch(() => false);

        if (isVisible) {
            const text = (await pill.textContent().catch(() => '')) || '';
            const match = text.match(/(\d+)/);
            if (match) {
                const count = parseInt(match[1], 10);
                if (previousCount === null || count > previousCount) {
                    await page.waitForTimeout(2000);
                    return count;
                }
            }
        }
        await page.waitForTimeout(500);
    }

    return previousCount ?? 0;
}
