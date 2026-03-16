import { When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import assert from 'node:assert/strict';
import type { CustomWorld } from '../../support/hooks';

// ─── Create-Run-Delete: back from canvas and delete agent ───────────────────

When('I click the back arrow beside the agent name', async function (this: CustomWorld) {
    assert(this.page, 'World.page was not initialized');
    console.log('Clicking back arrow to leave canvas...');
    // Back button: button with chevron-left icon (lucide-chevron-left)
    const backBtn = this.page
        .locator('button')
        .filter({ has: this.page.locator('svg.lucide-chevron-left') })
        .first();
    await expect(backBtn).toBeVisible({ timeout: 10_000 });
    await backBtn.click();
    await this.page.waitForTimeout(2000);
    console.log('✅ Back to list');
});

Then('I should see the Agentic Orchestrations list', async function (this: CustomWorld) {
    assert(this.page, 'World.page was not initialized');
    await expect(
        this.page.getByRole('heading', { name: /Agentic Orchestrations/i })
    ).toBeVisible({ timeout: 10_000 });
    console.log('✅ Agentic Orchestrations list visible');
});

When('I hover on the agent {string}', async function (this: CustomWorld, agentName: string) {
    assert(this.page, 'World.page was not initialized');
    const card = this.page.locator('div').filter({ hasText: new RegExp(agentName, 'i') }).first();
    await expect(card).toBeVisible({ timeout: 10_000 });
    await card.hover();
    await this.page.waitForTimeout(500);
    console.log(`✅ Hovered on agent "${agentName}"`);
});

When('I click the options menu on the agent {string}', async function (this: CustomWorld, agentName: string) {
    assert(this.page, 'World.page was not initialized');
    const card = this.page.locator('div').filter({ hasText: new RegExp(agentName, 'i') }).first();
    const menuBtn = card
        .getByRole('button', { name: /more|options|menu/i })
        .or(card.locator('button').last());
    await expect(menuBtn).toBeVisible({ timeout: 5_000 });
    await menuBtn.click();
    await this.page.waitForTimeout(500);
    console.log('✅ Options menu opened');
});

When('I click Delete in the menu', async function (this: CustomWorld) {
    assert(this.page, 'World.page was not initialized');
    const deleteItem = this.page.getByRole('menuitem', { name: /delete/i }).or(this.page.getByText('Delete', { exact: true }));
    await expect(deleteItem.first()).toBeVisible({ timeout: 5_000 });
    await deleteItem.first().click();
    console.log('✅ Delete clicked');
});

When('I confirm deletion in the dialog', async function (this: CustomWorld) {
    assert(this.page, 'World.page was not initialized');
    const dialog = this.page.getByRole('dialog', { name: /delete orchestration/i });
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    const confirmBtn = dialog.getByRole('button', { name: /^Delete$/i });
    await expect(confirmBtn).toBeVisible({ timeout: 3_000 });
    await confirmBtn.click();
    await this.page.waitForTimeout(2000);
    console.log('✅ Deletion confirmed');
});
