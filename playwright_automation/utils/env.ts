import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load env vars from:
// - repo root `.env` (common setup)
// - `playwright_automation/.env` (this suite's local env file)
//
// We load both because `npm run ...` executes from the package root, not necessarily from
// `playwright_automation/`, so relying on CWD-based loading is fragile.
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '..', '.env'), override: true });

export const REQUIRED_ENV_VARS = ['BASE_URL', 'USER_ID', 'PASSWORD'] as const;

export function getMissingRequiredEnvVars(): string[] {
  return REQUIRED_ENV_VARS.filter((k) => !(process.env[k] || '').trim());
}

function required(name: string): string {
  const v = (process.env[name] || '').trim();
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export type LoginEnv = {
  baseURL: string;
  userId: string;
  password: string;
};

export function getLoginEnv(): LoginEnv {
  return {
    baseURL: required('BASE_URL'),
    userId: required('USER_ID'),
    password: required('PASSWORD'),
  };
}

