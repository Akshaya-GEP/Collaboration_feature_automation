type EnvName = string | string[];

function normalizeNames(name: EnvName): string[] {
  return Array.isArray(name) ? name : [name];
}

/** Safe env access when process may be undefined (e.g. some runtimes). */
function getEnv(): Record<string, string | undefined> {
  const p = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process;
  if (p?.env) return p.env;
  return {};
}

/**
 * Returns the first defined, non-empty env var value among the provided names.
 */
export function envFirst(names: EnvName): string | undefined {
  const env = getEnv();
  for (const key of normalizeNames(names)) {
    const raw = env[key];
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (value) return value;
  }
  return undefined;
}

/**
 * Marks the current test as skipped if any of the required env vars are missing.
 *
 * Usage:
 *   const agentModel = requireEnvOrSkip(test, 'AGENT_MODEL');
 */
export function requireEnvOrSkip(
  test: { skip: (condition: boolean, description?: string) => void },
  names: EnvName,
  hint?: string
): string {
  const value = envFirst(names);
  const keys = normalizeNames(names).join(' or ');
  test.skip(!value, hint ?? `Missing required env var: ${keys}`);
  // At runtime, if skipped, this line won't execute; still keep a safe fallback type.
  return value ?? '';
}

/**
 * Convenience for workflow-ish defaults when running locally.
 */
export function defaultWorkflowName(prefix: string) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  return `pw-${prefix}-${ts}`;
}


