# Playwright BDD – Structure & Plan

This document defines the **folder structure**, **conventions**, and **plan** for the Playwright automation codebase (QI Studio / Portal Engine agent testing).

---

## 1. Directory structure (canonical)

All paths are relative to **`playwright_automation/`**.

```
playwright_automation/
├── .env                          # Secrets & config (not committed): BASE_URL, USER_ID, PASSWORD, JUDGE_*
├── .auth/                         # Persisted auth state (storage.json) – gitignored
├── test-results/                  # Failure screenshots: FAILED_<Scenario>_<timestamp>.png
├── package.json                   # Scripts, dependencies (Cucumber, Playwright, tsx)
├── README.md                      # Quick start, commands, setup
├── README_FRAMEWORK.md            # Unified steps, validation layers, adding tests
├── STRUCTURE_AND_PLAN.md          # This file
│
├── bdd/
│   ├── features/                  # Gherkin .feature files (by domain)
│   │   ├── auth/
│   │   │   └── login.feature
│   │   ├── core/
│   │   │   ├── AgentCreation.feature
│   │   │   ├── JsonAgent.feature
│   │   │   └── workflow.feature
│   │   ├── nodes/                 # Per-node / per-tool atomic tests
│   │   │   ├── ApiNode.feature
│   │   │   ├── AgentMCPTools.feature
│   │   │   ├── AgentSharedTools.feature
│   │   │   ├── AgentSystemTools.feature
│   │   │   ├── HandoffTool.feature
│   │   │   ├── InvokeOrchestrationNode.feature
│   │   │   ├── LLMNode.feature
│   │   │   ├── NodeSuite.feature   # Aggregated node suite
│   │   │   ├── RuleNode.feature
│   │   │   ├── ScriptNode.feature
│   │   │   ├── VariableNode.feature
│   │   │   └── (GuardrailNode if added)
│   │   ├── scenarios/            # End-to-end flows
│   │   │   └── CreateRunDelete.feature
│   │   ├── templates/
│   │   │   └── MasterTemplate.feature
│   │   └── validation/
│   │       ├── LLMValidation.feature
│   │       └── RunValidation.feature
│   │
│   ├── data/                      # JSON payloads & test data (no code)
│   │   ├── core/                  # Agent/workflow definitions for core flows
│   │   │   ├── agent_creation_testcase1.json
│   │   │   ├── agent_testcase1.json
│   │   │   ├── llm_testcase1.json
│   │   │   └── ...
│   │   ├── nodes/                 # One folder per node/tool type
│   │   │   ├── api-node/
│   │   │   ├── agent-mcp-tools/
│   │   │   ├── agent-shared-tools/
│   │   │   ├── agent-system-tools/
│   │   │   ├── guardrail/
│   │   │   ├── handoff-tool/
│   │   │   ├── invoke-orchestration-node/
│   │   │   ├── llm-node/
│   │   │   ├── rule-node/
│   │   │   ├── script-node/
│   │   │   ├── variable-node/
│   │   │   └── suite_testcase1.json (or similar)
│   │   ├── tools/                 # Shared/system tools payloads
│   │   │   ├── shared_tools_testcase1.json
│   │   │   └── system_tools_testcase1.json
│   │   └── validation/            # Conversation turns, examples
│   │       ├── conversation-turns.example.json
│   │       ├── llm-node-turns.json
│   │       └── rule-node-turns.json
│   │
│   ├── step-definitions/         # TypeScript step implementations (mirror features)
│   │   ├── common/
│   │   │   └── session.steps.ts   # Session, domain, “valid QI Studio session”
│   │   ├── auth/
│   │   │   └── login.steps.ts
│   │   ├── core/
│   │   │   ├── AgentCreation.steps.ts
│   │   │   ├── JsonAgent.steps.ts
│   │   │   └── workflow.steps.ts
│   │   ├── scenarios/
│   │   │   └── CreateRunDelete.steps.ts
│   │   ├── validation/
│   │   │   ├── LLMValidation.steps.ts
│   │   │   └── RunValidation.steps.ts
│   │   └── UnifiedFramework.steps.ts   # Unified JSON agent + single-shot validation
│   │
│   └── support/
│       └── hooks.ts               # Before/After, browser, context, screenshots, CustomWorld
│
├── pages/                         # Page Object Model (POM)
│   ├── auth/
│   │   ├── LoginPage.ts
│   │   └── loginhelper.ts
│   ├── config/
│   │   ├── DomainConfigPage.ts
│   │   └── domainhelper.ts
│   ├── components/
│   │   └── Sidebar.ts
│   ├── orchestration/
│   │   ├── OrchestrationHomePage.ts
│   │   ├── PropertiesPanel.ts
│   │   ├── JsonViewPanel.ts
│   │   ├── GraphEditorPage.ts
│   │   ├── NodesPanel.ts
│   │   ├── AgentNodePanel.ts
│   │   ├── LLMNodePanel.ts
│   │   ├── GuardrailNodePanel.ts
│   │   └── ...
│   ├── loginPage.ts               # Legacy; prefer auth/LoginPage
│   └── ...
│
├── utils/                         # Shared logic (no Gherkin)
│   ├── config.ts                  # Timeouts, base URL from env
│   ├── env.ts                     # getLoginEnv, getMissingRequiredEnvVars
│   ├── logger.ts                  # Logger (step, info, success)
│   ├── llmValidator.ts             # LLM validation: structure + LLM judge (no keyword layer)
│   ├── agentResponseValidator.ts  # Multi-turn conversation validation
│   ├── turnGenerator.ts           # LLM-generated conversation turns
│   ├── uiUtils.ts                 # ensureChatInterfaceReady, captureAgentResponse
│   └── workflowUtils.ts           # waitForAiEvents, etc.
│
└── scripts/                       # CLI helpers (run feature, step mapper)
    ├── run-feature.mjs
    └── stepMapper.mjs
```

---

## 2. Naming conventions

| Layer            | Convention | Example |
|------------------|------------|--------|
| Feature files    | PascalCase, one concept per file | `LLMNode.feature`, `RunValidation.feature` |
| Feature tags     | Snake_case, domain + purpose     | `@llm_node`, `@run_validation`, `@smoke` |
| Step definition files | Match feature area, `.steps.ts` | `LLMValidation.steps.ts`, `session.steps.ts` |
| Data folders     | kebab-case, one per node/tool    | `llm-node/`, `agent-mcp-tools/` |
| Data JSON files  | snake_case, descriptive          | `llm_testcase1.json`, `llm-node-turns.json` |
| Page objects     | PascalCase, suffix Page/Panel/Helper | `GraphEditorPage.ts`, `JsonViewPanel.ts` |
| Utils            | camelCase exports, descriptive  | `validateLLMResponse`, `captureAgentResponse` |

---

## 3. Tagging strategy

Use tags to select scenarios for different runs (local, CI, smoke, regression).

| Tag               | Use for |
|-------------------|--------|
| `@smoke`          | Critical path; run first in CI (login, one agent, one validation). |
| `@regression`     | Broader set; run after smoke or on schedule. |
| `@json_agent`     | JsonAgent.feature scenarios. |
| `@agent_creation` | AgentCreation.feature. |
| `@workflow`       | workflow.feature. |
| `@create_run_delete` | E2E CreateRunDelete.feature. |
| `@llm_node`       | LLM node scenarios. |
| `@rule_node`      | Rule node scenarios. |
| `@system_tools`   | Agent system tools. |
| `@shared_tools`   | Agent shared tools. |
| `@mcp_tools`      | Agent MCP tools. |
| `@nodes`          | NodeSuite.feature. |
| `@run_validation` | Run validation (API 200) scenarios. |
| `@llm_validation` | LLM response validation scenarios. |
| `@unified_template` | MasterTemplate.feature. |

**CI recommendation:**  
- PR / main: run `@smoke` then optionally `@regression` or tag subsets.  
- Keep smoke small and stable (e.g. login + one run validation + one LLM validation).

---

## 4. Test types and where they live

| Type            | Purpose | Features | Steps / Utils |
|-----------------|--------|----------|----------------|
| Auth            | Login, domain config | `auth/login.feature` | `auth/login.steps.ts`, `common/session.steps.ts` |
| Core            | Agent creation, JSON agent, workflow | `core/*.feature` | `core/*.steps.ts` |
| Nodes           | Single node/tool behavior | `nodes/*.feature` | Reuse core + unified + validation |
| Scenarios       | Full E2E (create → run → delete) | `scenarios/*.feature` | `scenarios/*.steps.ts` |
| Validation      | API status + LLM content | `validation/*.feature` | `validation/*.steps.ts`, `utils/llmValidator.ts`, `agentResponseValidator.ts` |
| Templates       | Reusable blueprint | `templates/MasterTemplate.feature` | UnifiedFramework.steps.ts |

---

## 5. Flow: from feature to execution

1. **Feature** (`bdd/features/**/*.feature`)  
   - Gherkin: Feature, Background, Scenario(s), tags.  
   - Use Background for common setup (e.g. “valid QI Studio session”).  
   - Prefer unified step: `Then the agent should correctly answer the query "..." with these rules:` when validating one reply.

2. **Step definitions** (`bdd/step-definitions/**/*.steps.ts`)  
   - Implement When/Then/Given; use `CustomWorld` (page, context, stored state).  
   - Call **page objects** for UI, **utils** for validation/config/env.

3. **Support** (`bdd/support/hooks.ts`)  
   - BeforeAll: env check.  
   - Before: browser/context, optional auth reuse.  
   - After: screenshot on failure, cleanup.  
   - CustomWorld holds page, context, `loadedTurns`, etc.

4. **Data** (`bdd/data/**/*.json`)  
   - Referenced by path in steps (e.g. “paste agent JSON from bdd/data/nodes/llm-node/llm_testcase1.json”).  
   - Keep payloads in `data/`; no test logic in JSON.

5. **Run**  
   - From `playwright_automation`: `npm run bdd:<target>` or `npm run bdd:<target>:headed`.  
   - Target = tag or script name (e.g. `bdd:smoke`, `bdd:json-agent`, `bdd:run-validate`).

---

## 6. Plan: adding a new test

1. **New node/tool**  
   - Add `bdd/features/nodes/<NodeName>.feature` (and/or add to `NodeSuite.feature`).  
   - Add `bdd/data/nodes/<node-name>/<name>_testcase1.json`.  
   - Reuse steps from `UnifiedFramework.steps.ts`, `core/*.steps.ts`, `validation/*.steps.ts`; add node-specific steps only if needed in `core/` or a new step file.  
   - Tag scenarios (e.g. `@llm_node`, `@smoke`).

2. **New validation scenario**  
   - Add scenario to `LLMValidation.feature` or `RunValidation.feature`.  
   - If multi-turn: add or reuse JSON in `bdd/data/validation/`.  
   - Use existing steps (“I load conversation turns from …”, “the agent conversation should match the loaded turns”, “the agent should correctly answer the query … with these rules”).

3. **New E2E scenario**  
   - Add to `scenarios/CreateRunDelete.feature` or new `scenarios/<Name>.feature`.  
   - Implement any new steps in `scenarios/*.steps.ts` or shared step-definition files.

4. **New page/screen**  
   - Add page object under `pages/<area>/<Name>Page.ts` (or Panel/Helper).  
   - Use in step definitions; keep selectors and high-level actions in the page object.

---

## 7. Plan: CI alignment

- **Workflow file:** `.github/workflows/playwright-pr.yml` (or equivalent).  
- **Recommendation:**  
  - Install deps, set env (secrets for BASE_URL, USER_ID, PASSWORD; optional JUDGE_* for LLM validation).  
  - Run `npm run bdd:smoke` (and optionally `bdd:run-validate` or `bdd:regression`).  
  - Store/attach `test-results/` and possibly Cucumber reports on failure.  
- Keep **smoke** fast and reliable; use **regression** or tag-based jobs for broader coverage.

---

## 8. Maintenance and hygiene

- **One scenario, one concern:** Avoid long scenarios that mix login, multiple nodes, and several validations; split or use Background + small scenarios.  
- **Reuse over duplicate:** Prefer unified step and shared steps; add new step definitions only when the same phrase is used in multiple features.  
- **Data vs code:** Keep test payloads in `bdd/data/`; avoid hardcoding large JSON in steps.  
- **Env:** Document all used env vars in README and `.env.example` (no secrets); require only BASE_URL, USER_ID, PASSWORD for core runs.  
- **Tags:** Use consistent tags so CI and local runs can select the same sets (e.g. `@smoke`, `@regression`).

---

## 9. Quick reference: npm scripts (from package.json)

| Script | Tags / target |
|--------|----------------|
| `bdd:smoke` / `bdd:smoke:headed` | `@smoke` |
| `bdd:regression` / `bdd:regression:headed` | `@regression` |
| `bdd:login` / `bdd:login:headed` | login feature |
| `bdd:workflow` / `bdd:workflow:headed` | `@workflow` |
| `bdd:agent` / `bdd:agent:headed` | `@agent_creation` |
| `bdd:json-agent` / `bdd:json-agent:headed` | `@json_agent` |
| `bdd:create-run-delete` / `:headed` | `@create_run_delete` |
| `bdd:llm-node` / `:headed` | `@llm_node` |
| `bdd:run-validate` / `:headed` | `@run_validation` |
| `bdd:llm-validate` / `:headed` | `@llm_validation` |
| `bdd:unified` / `bdd:unified:headed` | MasterTemplate, `@unified_template` |
| `test:llm`, `test:rule`, `test:agent:system`, `test:agent:shared`, `test:agent:mcp`, `test:suite` | Node-specific / suite |
| `step-map` / `step-map:apply` | Step mapper (undefined steps) |
| `run:feature` / `run:feature:headed` | Run a single feature (script) |

Use this document as the single source of truth for **structure** and **plan** when adding or refactoring Playwright BDD code.
