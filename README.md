# Playwright BDD Automation

Browser automation for the Portal Engine using **Playwright** and **Cucumber** (BDD). Use this to run login flows, create agents via JSON, validate AI responses, and run end-to-end scenarios.

---

## Quick run (see the browser)

From the **`playwright_automation`** folder:

```bash
npm run bdd:json-agent:headed
```

This runs **5 test cases** (Agent creation flow) with the browser visible.  
Other commands below can be run with `:headed` to see the browser (e.g. `npm run bdd:login:headed`).

---

## Prerequisites

- **Node.js** (v18+)
- **npm** (from the `playwright_automation` folder run `npm install` once)

---

## Setup

1. **Go to the automation folder**
   ```bash
   cd playwright_automation
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**  
   Copy or create a `.env` in `playwright_automation` with:
   - `BASE_URL` – Portal URL
   - `USER_ID` – Login user
   - `PASSWORD` – Login password  
   Optional: `JUDGE_API_KEY` for LLM-based answer validation.

Optional for **Step Mapper**: `OPENAI_API_KEY` or Azure (`AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT`) to map undefined Gherkin steps to existing definitions.

Optional for **AI Events**: `AI_EVENTS_PILL_REGEX` (regex string for an "AI Events (N)"-style indicator; use `off` or `none` to disable pill and use network-only wait), `AI_EVENTS_TIMEOUT_MS` (default 180000).

---

## Commands to run

All commands are run from **`playwright_automation`**.

| What you want to do              | Command (headless)        | Command (browser visible)           |
|----------------------------------|---------------------------|-------------------------------------|
| **JSON Agent flow (5 tests)**    | `npm run bdd:json-agent`  | `npm run bdd:json-agent:headed`     |
| Login only                       | `npm run bdd:login`       | `npm run bdd:login:headed`          |
| Agent creation                   | `npm run bdd:agent`       | `npm run bdd:agent:headed`          |
| Workflow                         | `npm run bdd:workflow`    | `npm run bdd:workflow:headed`       |
| Create → Run → Delete (E2E)      | `npm run bdd:create-run-delete` | `npm run bdd:create-run-delete:headed` |
| LLM node tests                   | `npm run bdd:llm-node`    | `npm run bdd:llm-node:headed`       |
| LLM validation                   | `npm run bdd:llm-validate`| `npm run bdd:llm-validate:headed`   |
| Unified template                 | `npm run bdd:unified`     | `npm run bdd:unified:headed`        |

- **Headless** = no browser window (faster, for CI).
- **Headed** = browser window opens so you can watch the test.

---

## Failure screenshots

When a scenario fails, a screenshot is saved under:

```text
playwright_automation/test-results/
```

Files are named like: `FAILED_<ScenarioName>_<timestamp>.png`.

---

## Project structure

All paths are relative to **`playwright_automation/`**. This section describes where everything lives and what it is for.

### Root

| Path | Purpose |
|------|--------|
| `package.json` | npm scripts (e.g. `bdd:json-agent:headed`) and dependencies |
| `.env` | Config: `BASE_URL`, `USER_ID`, `PASSWORD`, optional `JUDGE_API_KEY` (not committed) |
| `test-results/` | Failure screenshots: `FAILED_<Scenario>_<timestamp>.png` (created on first failure) |
| `README.md` | This file |
| `README_FRAMEWORK.md` | Framework details: unified steps, validation layers, adding tests |

---

### `bdd/` — Cucumber (BDD) tests

Gherkin features, test data, and step definitions.

```text
bdd/
├── features/                    # Gherkin .feature files (scenarios)
│   ├── auth/
│   │   └── login.feature         # Login flow
│   ├── core/
│   │   ├── AgentCreation.feature
│   │   ├── JsonAgent.feature     # JSON Agent flow (5 scenarios)
│   │   └── workflow.feature
│   ├── nodes/                    # Node-level tests (LLM, Rule, Agent tools)
│   │   ├── AgentMCPTools.feature
│   │   ├── AgentSharedTools.feature
│   │   ├── AgentSystemTools.feature
│   │   ├── LLMNode.feature
│   │   ├── NodeSuite.feature
│   │   └── RuleNode.feature
│   ├── scenarios/
│   │   └── CreateRunDelete.feature   # E2E create → run → delete
│   ├── templates/
│   │   └── MasterTemplate.feature     # Reusable template
│   └── validation/
│       ├── LLMValidation.feature      # LLM-as-judge validation
│       └── RunValidation.feature
│
├── data/                        # JSON payloads and test data
│   ├── core/                    # Agent/workflow definitions for core flows
│   │   ├── agent.json
│   │   ├── agent creation.json
│   │   └── llm_node.json
│   ├── nodes/                   # Per-node scenario data (positive/negative)
│   │   ├── agent-mcp-tools/     # positive.json, negative.json
│   │   ├── agent-shared-tools/
│   │   ├── agent-system-tools/
│   │   ├── guardrail/
│   │   ├── llm-node/
│   │   ├── rule-node/
│   │   └── suite.json
│   ├── tools/
│   │   ├── shared tools.json
│   │   └── system tools.json
│   └── validation/              # Conversation turns for validation tests
│       ├── conversation-turns.example.json
│       ├── llm-node-turns.json
│       └── rule-node-turns.json
│
├── step-definitions/            # TypeScript step implementations
│   ├── auth/
│   │   └── login.steps.ts
│   ├── core/
│   │   ├── AgentCreation.steps.ts
│   │   ├── JsonAgent.steps.ts
│   │   └── workflow.steps.ts
│   ├── scenarios/
│   │   └── CreateRunDelete.steps.ts
│   ├── validation/
│   │   ├── LLMValidation.steps.ts
│   │   └── RunValidation.steps.ts
│   └── UnifiedFramework.steps.ts   # Unified step (API + UI + validation)
│
└── support/
    └── hooks.ts                 # Before/After: browser, context, screenshot on failure
```

---

### `pages/` — Page objects and UI helpers

Reusable UI abstractions used by step definitions.

```text
pages/
├── auth/
│   ├── LoginPage.ts
│   └── loginhelper.ts
├── components/
│   └── Sidebar.ts
├── config/
│   ├── DomainConfigPage.ts
│   └── domainhelper.ts
├── orchestration/               # Orchestration / graph editor UI
│   ├── AgentNodePanel.ts
│   ├── GraphEditorPage.ts
│   ├── GuardrailNodePanel.ts
│   ├── JsonViewPanel.ts
│   ├── LLMNodePanel.ts
│   ├── NodesPanel.ts
│   ├── OrchestrationHomePage.ts
│   └── PropertiesPanel.ts
└── loginPage.ts
```

---

### `utils/` — Shared utilities

| File | Purpose |
|------|--------|
| `env.ts` | Load and validate `.env` (e.g. `getLoginEnv()`, `getMissingRequiredEnvVars()`) |
| `llmValidator.ts` | LLM validation: structure + LLM judge (no keyword layer) |
| `agentResponseValidator.ts` | Agent response validation helpers |
| `turnGenerator.ts` | Generate conversation turns for validation |
| `uiUtils.ts` | UI interaction helpers |
| `logger.ts` | Logging |
| `config.ts` | Config / constants |
| `workflowUtils.ts` | `waitForAiEvents()`: wait for AI events pill to increment or for network to settle; used in chat/agent steps |

---

## AI Events and Step Mapper

### AI Events

Steps that send a message or trigger the agent (e.g. "I send the message", "I type and send message") use `waitForAiEvents()` so the test waits for the AI/network to settle before continuing. If the app shows an "AI Events (N)"-style counter, the helper waits for the count to increase; otherwise it falls back to a short network-idle wait. Configure via `.env`: `AI_EVENTS_PILL_REGEX` (regex string; `off`/`none` to disable pill), `AI_EVENTS_TIMEOUT_MS` (default 180000).

### Step Mapper

The Step Mapper finds undefined steps in a feature file and uses OpenAI or Azure OpenAI to map them to existing step definitions (and optionally rewrite the feature with converted steps).

- **Run (report only):**  
  `npm run step-map`  
  Uses default feature `bdd/features/nodes/LLMNode.feature`.  
  Or: `npm run step-map -- bdd/features/path/to/file.feature`

- **Apply converted steps to the feature file:**  
  `npm run step-map:apply -- bdd/features/path/to/file.feature`  
  Or: `npm run step-map -- bdd/features/path/to/file.feature --apply`  
  Optional: `--out path/to/output.feature` to write to a different file.

- **Required env:**  
  - **OpenAI:** `OPENAI_API_KEY` (optional: `OPENAI_MODEL`, default `gpt-4o-mini`)  
  - **Azure:** `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_API_VERSION`

---

### `tests/` — Standalone Playwright specs (non-Cucumber)

Optional `.spec.ts` tests (auth, workflow, domain config). Main automation runs via BDD commands above.

```text
tests/
├── auth/
│   ├── debug-flow.spec.ts
│   ├── debug-login.spec.ts
│   ├── login.spec.ts
│   └── save-auth-state.spec.ts
├── agentic/
│   └── workflow.spec.ts
├── domain/
│   └── domain-config.spec.ts
└── helpers/
    └── env.ts
```

---

## More detail

- **Framework and validation:** see [README_FRAMEWORK.md](./README_FRAMEWORK.md) for unified steps, LLM validation (structure + LLM judge), and how to add new test cases.


$env:HEADED="1"; npx playwright test tests/dashboard/collaboration.spec.ts