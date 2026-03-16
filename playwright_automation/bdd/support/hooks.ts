import { After, AfterAll, AfterStep, Before, BeforeAll, setDefaultTimeout, setWorldConstructor, Status } from '@cucumber/cucumber';
import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { getLoginEnv, getMissingRequiredEnvVars, type LoginEnv } from '../../utils/env';

const ROOT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
/** test-results dir inside playwright_automation (screenshots on failure) */
const TEST_RESULTS_DIR = path.join(ROOT_DIR, 'test-results');
/** Saved cookies + localStorage after first login; reused so we skip login in later scenarios */
export const AUTH_STORAGE_PATH = path.join(ROOT_DIR, '.auth', 'storage.json');

// Login + IdP redirects can be slow.
setDefaultTimeout(300_000);

export class CustomWorld {
  env: LoginEnv | undefined;
  context: BrowserContext | undefined;
  page: Page | undefined;
  /** True when this scenario's context was created with saved storage state (cookies); skip login and reuse session */
  usedStorageState?: boolean;
  /** Set when a step fails; used in After to take screenshot */
  scenarioFailed?: boolean;
  /** Scenario name for screenshot filename and failure report */
  scenarioName?: string;
  /** Feature file path (e.g. bdd/features/nodes/LLMNode.feature) so we know which file failed */
  featureFile?: string;
  /** Last seen AI events count; used by waitForAiEvents to wait for new activity. Reset per scenario. */
  aiEventsCount: number | null = null;
  /** Loaded conversation turns (from JSON or generated); used by LLM validation steps. */
  loadedTurns?: Array<{ userMessage: string; expectedResponse: string; matchType: string; expectedIntent?: string; minKeywords?: number }>;
  /** Chat selectors for multi-turn validation. */
  loadedSelectors?: { userQuerySelector?: string; agentResponseSelector?: string };
  /** Minimum score per turn (0–100) from validation config or step. */
  loadedMinScore?: number;
  /** Override chat input selector for multi-turn table step. */
  chatUserQuerySelector?: string;
  /** Override agent response selector for multi-turn table step. */
  chatAgentResponseSelector?: string;
  /** Stores the input JSON content used to create the agent, for reproduction on failure. */
  usedJsonContent?: string;

  /** Cucumber's attach method for embedding data in reports */
  attach: any;

  constructor({ attach }: any) {
    this.attach = attach;
  }
}

setWorldConstructor(CustomWorld);

let browser: Browser | undefined;
let envGlobal: LoginEnv | undefined;

function isTruthyEnv(name: string): boolean {
  return ['1', 'true', 'yes', 'y', 'on'].includes(String(process.env[name] || '').trim().toLowerCase());
}

async function getOrLaunchBrowser(): Promise<Browser> {
  if (browser && browser.isConnected()) return browser;

  const headless = !isTruthyEnv('PW_HEADED') && !isTruthyEnv('HEADED');
  browser = await chromium.launch({ headless });
  browser.on('disconnected', () => {
    browser = undefined;
  });
  return browser;
}

BeforeAll(async () => {
  const missing = getMissingRequiredEnvVars();
  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
  envGlobal = getLoginEnv();
});

Before(async function (this: CustomWorld, opts?: { pickle?: { name?: string; uri?: string } }) {
  this.env = envGlobal!;
  this.scenarioFailed = false;
  this.scenarioName = opts?.pickle?.name ?? 'scenario';
  this.featureFile = opts?.pickle?.uri ?? '';
  this.aiEventsCount = null;
  const b = await getOrLaunchBrowser();
  const useSavedSession = fs.existsSync(AUTH_STORAGE_PATH);
  this.usedStorageState = useSavedSession;
  this.context = await b.newContext({
    storageState: useSavedSession ? AUTH_STORAGE_PATH : undefined,
    permissions: ['clipboard-read', 'clipboard-write']
  });
  this.page = await this.context.newPage();
});

AfterStep(async function (this: CustomWorld, { result }: { result: { status: unknown } }) {
  if (result?.status === Status.FAILED) this.scenarioFailed = true;
});

After(async function (this: CustomWorld) {
  if (this.scenarioFailed && this.page) {
    const baseDir = TEST_RESULTS_DIR;
    const featureFile = this.featureFile ?? '';
    const scenarioName = this.scenarioName ?? 'scenario';
    const safeScenario = scenarioName.replace(/\W+/g, '_').slice(0, 40);
    const safeFile = featureFile.replace(/\W+/g, '_').replace(/^.*[\\/]/, '').replace(/\.feature$/, '') || 'unknown';
    const filename = `FAILED_${safeFile}_${safeScenario}_${Date.now()}.png`;
    const filepath = path.join(baseDir, filename);
    fs.mkdirSync(baseDir, { recursive: true });
    const screenshot = await this.page!.screenshot({ path: filepath }).catch((err) => {
      console.error('Screenshot on failure failed:', err);
      return null;
    });
    if (screenshot) {
      await this.attach(screenshot, 'image/png');
    }

    if (this.usedJsonContent) {
      await this.attach(this.usedJsonContent, 'application/json');
    }

    console.error('\n*** SCENARIO FAILED ***');
    console.error(`  File:    ${featureFile || '(unknown)'}`);
    console.error(`  Scenario: ${scenarioName}`);
    console.error(`  Screenshot: ${filepath}\n`);
  }
  await this.context?.close().catch(() => { });
  this.context = undefined;
  this.page = undefined;
});

AfterAll(async () => {
  if (browser && browser.isConnected()) {
    await browser.close().catch(() => { });
  }
  browser = undefined;
});

