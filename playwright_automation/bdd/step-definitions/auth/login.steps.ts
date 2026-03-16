import { Given, Then, When } from '@cucumber/cucumber';
import assert from 'node:assert/strict';

import { LoginPage } from '../../../pages/loginPage';
import type { CustomWorld } from '../../support/hooks';

Given('I open QI Studio login page', async function (this: CustomWorld) {
    assert(this.page, 'World.page was not initialized (hook failure)');
    assert(this.env, 'World.env was not initialized (hook failure)');

    await this.page.goto(this.env.baseURL, { waitUntil: 'domcontentloaded', timeout: 120_000 });
});

When('I enter email {string} and password {string}', async function (this: CustomWorld, email: string, password: string) {
    assert(this.page, 'World.page was not initialized (hook failure)');
    assert(this.env, 'World.env was not initialized (hook failure)');

    // Allow empty strings in the feature file: fall back to env values.
    const effectiveEmail = (email || '').trim() || this.env.userId;
    const effectivePassword = (password || '').trim() || this.env.password;

    const loginPage = new LoginPage(this.page);
    await loginPage.login(effectiveEmail, effectivePassword);
});

When('I click Yes on Stay signed in if prompted', async function (this: CustomWorld) {
    assert(this.page, 'World.page was not initialized (hook failure)');

    const loginPage = new LoginPage(this.page);
    await loginPage.acceptStaySignedInIfPresent();
});

Then('I should be logged into QI Studio', async function (this: CustomWorld) {
    assert(this.page, 'World.page was not initialized (hook failure)');

    const loginPage = new LoginPage(this.page);
    await loginPage.assertLoggedIn();
});

