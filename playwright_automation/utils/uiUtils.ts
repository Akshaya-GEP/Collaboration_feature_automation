import { Page, expect, Locator } from '@playwright/test';
import Logger from './logger';

/**
 * Common UI Utilities for Playwright
 */
export async function ensureChatInterfaceReady(page: Page, timeout: number = 20000): Promise<void> {
    const chatInput = page.getByPlaceholder(/message/i).or(page.locator('input, textarea').last());

    Logger.info('Ensuring chat panel is open...');

    for (let attempt = 1; attempt <= 3; attempt++) {
        const isVisible = await chatInput.first().isVisible({ timeout: 2000 }).catch(() => false);
        if (isVisible) {
            Logger.success('Chat interface ready');
            return;
        }

        Logger.warn(`Attempt ${attempt}: Chat not visible. Cleaning UI...`);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);

        const runBtn = page.getByRole('button', { name: /^Run$/i });
        if (await runBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await runBtn.click({ force: true });
        } else {
            await page.keyboard.press('r');
        }
        await page.waitForTimeout(2000);
    }

    await expect(chatInput.first()).toBeVisible({ timeout });
}

export async function captureAgentResponse(page: Page): Promise<string> {
    const responseSelectors = [
        '[class*="assistant"][class*="message"]',
        '[data-role="assistant"]',
        '[class*="chat-bubble"]:not([class*="user"])',
        '[class*="message"]:last-child:not([class*="user"])',
        '.chat-message.assistant',
    ];

    await page.waitForTimeout(3000); // Give time for stream completion

    for (const selector of responseSelectors) {
        const elements = page.locator(selector);
        const count = await elements.count();
        if (count > 0) {
            const text = await elements.last().textContent().catch(() => '');
            if (text && text.trim().length > 2) {
                const captured = text.trim();
                Logger.info(`Captured Response: "${captured.substring(0, 50)}..."`);
                return captured;
            }
        }
    }

    throw new Error('Failed to capture agent response from any known selector');
}

export async function clearAndFill(locator: Locator, text: string): Promise<void> {
    await locator.click();
    await locator.focus();
    await (locator as any).fill(''); // Clear
    await locator.pressSequentially(text, { delay: 30 });
}
