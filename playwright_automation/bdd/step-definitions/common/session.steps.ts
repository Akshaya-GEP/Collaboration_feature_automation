/**
 * Common session step: open app + login (or reuse cookies) + domain config (app/module selection).
 * Used as a single Background step so all testcases share one login flow with cookie reuse.
 */
import { Given } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { LoginPage } from '../../../pages/loginPage';
import { configureDomain } from '../../../pages/config/domainhelper';
import type { CustomWorld } from '../../support/hooks';
import { AUTH_STORAGE_PATH } from '../../support/hooks';

function getAppUrl(): string {
  const url = (process.env.APP_URL || process.env.BASE_URL || '').trim() || 'https://qistudio.gep.com/leo-dev-agent-api';
  if (url && (url.endsWith('/') || url.match(/^https?:\/\/[^/]+\/?$/))) {
    return url.replace(/\/?$/, '') + '/leo-dev-agent-api';
  }
  return url;
}

Given(/^I have a valid QI Studio session \(login and domain configured\)$/, async function (this: CustomWorld) {
  assert(this.page, 'World.page was not initialized (hook failure)');
  const appUrl = getAppUrl();
  await this.page.goto(appUrl, { waitUntil: 'domcontentloaded', timeout: 120_000 });

  if (this.usedStorageState) {
    console.log('Reusing saved session (cookies) – skipping login');
    await configureDomain(this.page!);
    return;
  }

  if (process.env.SKIP_LOGIN) {
    await configureDomain(this.page!);
    return;
  }

  assert(this.env, 'World.env was not initialized (hook failure)');
  const loginPage = new LoginPage(this.page!);
  await loginPage.login(this.env.userId, this.env.password);
  await loginPage.assertLoggedIn();

  const currentUrl = this.page!.url();
  const isAlreadyOnApp = currentUrl.startsWith(appUrl) || currentUrl.includes('leo-dev-agent-api');
  if (!isAlreadyOnApp) {
    await this.page!.goto(appUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await this.page!.waitForLoadState('domcontentloaded');
  }

  await configureDomain(this.page!);

  const authDir = path.dirname(AUTH_STORAGE_PATH);
  fs.mkdirSync(authDir, { recursive: true });
  await this.context!.storageState({ path: AUTH_STORAGE_PATH });
  console.log('Saved session to', AUTH_STORAGE_PATH, '– future scenarios will reuse cookies');
});
