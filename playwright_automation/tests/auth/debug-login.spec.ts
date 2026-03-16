import { test } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

test.use({ storageState: undefined });

test.setTimeout(120000);

test('Debug: Check qistudio page after login', async ({ page, context }) => {
  console.log('🔐 Starting authentication flow...\n');
  
  await page.goto('https://qistudio.gep.com');
  
  // Complete Microsoft SSO login
  await page.fill('input[type="email"]', process.env.USER_EMAIL!);
  await page.click('input[type="submit"]');
  
  await page.waitForSelector('input[type="password"]', { state: 'visible', timeout: 10000 });
  await page.fill('input[type="password"]', process.env.USER_PASSWORD!);
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
  
  // Wait for redirect
  await page.waitForURL(/build\.gep\.com|qistudio\.gep\.com/i, { timeout: 60000 });
  
  console.log('✅ Initial landing URL: ' + page.url() + '\n');
  
  // Wait longer and watch for changes
  console.log('⏳ Waiting 15 seconds to see if URL changes or cookies appear...\n');
  await page.waitForTimeout(15000);
  
  console.log('📍 Current URL after wait: ' + page.url() + '\n');
  
  // Check page title and content
  const title = await page.title();
  console.log('📄 Page title: ' + title + '\n');
  
  // Take a screenshot to see what's on the page
  await page.screenshot({ path: 'debug-after-login.png', fullPage: true });
  console.log('📸 Screenshot saved to debug-after-login.png\n');
  
  // Check all cookies
  const cookies = await context.cookies();
  
  console.log('🍪 ALL COOKIES:');
  cookies.forEach(c => {
    console.log('   ' + c.domain + ' -> ' + c.name);
  });
  
  const qistudioCookies = cookies.filter(c => c.domain.includes('qistudio'));
  const buildCookies = cookies.filter(c => c.domain.includes('build.gep'));
  
  console.log('\n📊 SUMMARY:');
  console.log('   qistudio cookies: ' + qistudioCookies.length);
  console.log('   build.gep.com cookies: ' + buildCookies.length);
  console.log('   Total: ' + cookies.length);
  
  // Don't save yet - just debug
  console.log('\n⚠️  Not saving auth.json - this is just for debugging');
  console.log('Check the screenshot to see what page you landed on!');
  
  // Keep browser open to inspect manually
  await page.pause();
});
