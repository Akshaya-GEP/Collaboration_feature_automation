import { test } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

test.use({ storageState: undefined });

test('Debug: Track authentication flow', async ({ page, context }) => {
  console.log('🔍 Starting login flow debug...\n');
  
  // Track all page navigations
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
      console.log(`📍 Navigated to: ${frame.url()}`);
    }
  });
  
  console.log(`🔐 Starting URL: ${process.env.LOGIN_URL}`);
  await page.goto(process.env.LOGIN_URL!);

  // Login steps
  await page.fill('input[type="email"]', process.env.USER_EMAIL!);
  await page.click('input[type="submit"]');
  
  await page.waitForSelector('input[type="password"]', { state: 'visible' });
  await page.fill('input[type="password"]', process.env.USER_PASSWORD!);
  await page.click('input[type="submit"]');
  
  console.log('\n⏳ Complete MFA on your device...\n');
  
  // Click "Stay signed in"
  const staySignedInButton = page.locator('#idSIButton9');
  if (await staySignedInButton.isVisible({ timeout: 120000 }).catch(() => false)) {
    await staySignedInButton.click();
  }

  // Wait for final page
  await page.waitForLoadState('networkidle', { timeout: 60000 });
  await page.waitForTimeout(5000);
  
  console.log(`\n✅ FINAL URL: ${page.url()}\n`);
  
  // Show all cookies grouped by domain
  const cookies = await context.cookies();
  const cookiesByDomain: Record<string, string[]> = {}; // Fixed type
  
  cookies.forEach(c => {
    const domain = c.domain;
    if (!cookiesByDomain[domain]) {
      cookiesByDomain[domain] = [];
    }
    cookiesByDomain[domain].push(c.name);
  });
  
  console.log('🍪 COOKIES BY DOMAIN:');
  Object.keys(cookiesByDomain).sort().forEach(domain => {
    console.log(`\n   ${domain}:`);
    cookiesByDomain[domain].forEach(name => {
      console.log(`      - ${name}`);
    });
  });
  
  await context.storageState({ path: 'auth-debug.json' });
  console.log('\n✅ Saved to auth-debug.json');
});
