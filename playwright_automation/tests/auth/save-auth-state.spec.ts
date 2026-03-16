import { test } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

test.use({ storageState: undefined });

test.setTimeout(120000);

test('Save auth with localStorage for qistudio.gep.com', async ({ page, context }) => {
  const email = process.env.USER_EMAIL ?? process.env.USER_A_EMAIL ?? '';
  const password = process.env.USER_PASSWORD ?? process.env.USER_A_PASSWORD ?? '';
  test.skip(!email || !password, 'Set USER_EMAIL and USER_PASSWORD (or USER_A_EMAIL and USER_A_PASSWORD) in .env to run this test.');

  console.log('🔐 Starting authentication flow...\n');

  await page.goto('https://qistudio.gep.com');

  // Complete Microsoft SSO login
  await page.fill('input[type="email"]', email);
  await page.click('input[type="submit"]');

  await page.waitForSelector('input[type="password"]', { state: 'visible', timeout: 10000 });
  await page.fill('input[type="password"]', password);
  await page.click('input[type="submit"]');
  
  console.log('⏳ Complete MFA on your device...\n');
  
  const staySignedInButton = page.locator('input[type="submit"][value="Yes"]');
  try {
    await staySignedInButton.waitFor({ state: 'visible', timeout: 120000 });
    await staySignedInButton.click();
    console.log('✅ Clicked "Stay signed in"\n');
  } catch (e) {
    console.log('⚠️  "Stay signed in" button not found\n');
  }
  
  // Wait for redirect to qistudio
  await page.waitForURL(/qistudio\.gep\.com/i, { timeout: 60000 });
  console.log('✅ Landed on: ' + page.url() + '\n');
  
  // CRITICAL: Wait for the SPA to initialize and set localStorage
  console.log('⏳ Waiting for application to initialize and set localStorage...\n');
  await page.waitForTimeout(10000); // 10 seconds for SPA to boot
  
  // Check if localStorage has auth data
  const localStorageData = await page.evaluate(() => {
    const data: any = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        data[key] = localStorage.getItem(key);
      }
    }
    return data;
  });
  
  console.log('📦 localStorage keys found: ' + Object.keys(localStorageData).length);
  console.log('   Keys: ' + Object.keys(localStorageData).join(', ') + '\n');
  
  // Check sessionStorage too
  const sessionStorageData = await page.evaluate(() => {
    const data: any = {};
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key) {
        data[key] = sessionStorage.getItem(key);
      }
    }
    return data;
  });
  
  console.log('📦 sessionStorage keys found: ' + Object.keys(sessionStorageData).length);
  console.log('   Keys: ' + Object.keys(sessionStorageData).join(', ') + '\n');
  
  // Save storage state (includes cookies, localStorage, and sessionStorage)
  await context.storageState({ path: 'auth.json' });
  
  // Verify what was saved
  const cookies = await context.cookies();
  console.log('📊 SAVED TO auth.json:');
  console.log('   Cookies: ' + cookies.length);
  console.log('   localStorage items: ' + Object.keys(localStorageData).length);
  console.log('   sessionStorage items: ' + Object.keys(sessionStorageData).length + '\n');
  
  console.log('✅ Saved auth.json with localStorage and sessionStorage!');
  console.log('🎉 Your tests should now work without MFA!');
});
