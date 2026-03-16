# Portal Engine BDD Automation Framework

Use this framework to rapidly create and validate AI agent scenarios.

## 🚀 Quick Start: Creating a New Test Case

1. **Prepare your Data**: Place your agent's JSON definition in `bdd/data/core/` or `bdd/data/nodes/`.
2. **Create a Feature File**: Use `bdd/features/templates/MasterTemplate.feature` as your blueprint.
3. **Use the Unified Validation Step**:
   ```gherkin
   Then the agent should correctly answer the query "Your Question" with these rules:
     | Rule           | Value                                   |
     | minLength      | 50                                      |
     | expectedIntent | The semantic meaning you expect         |
   ```

## 🏗️ Core Architecture

### 1. Unified Step Definitions
Located in `bdd/step-definitions/unified/UnifiedFramework.steps.ts`.
This reduces boilerplate by combining:
- **API Interception**: Automatically waits for the network response and asserts **200 OK**.
- **UI Capture**: Intelligently finds the AI's response in the chat bubble.
- **Semantic Validation**: Runs structure + LLM Judge (no keyword layer).

### 2. Validation (utils/llmValidator.ts)
- **Layer 1 (Structural)**: Ensures the response isn't empty, too short, or containing tech errors (e.g., "[object Object]").
- **Layer 2 (LLM Judge)**: Uses an LLM to score the *meaning* of the answer against expected intent (requires `JUDGE_API_KEY`).

## 📂 Directory Structure

```text
playwright_automation/
├── bdd/
│   ├── features/ (Grouped by test type)
│   │   ├── auth/           # login.feature
│   │   ├── core/           # AgentCreation, JsonAgent, workflow
│   │   ├── nodes/          # LLMNode, RuleNode, AgentTools (Atomic tests)
│   │   ├── scenarios/      # CreateRunDelete (E2E)
│   │   ├── templates/      # MasterTemplate
│   │   └── validation/     # LLMValidation, RunValidation
│   │
│   ├── data/ (Grouped by payload type)
│   │   ├── core/           # agent.json, agent creation.json, llm_node.json
│   │   ├── nodes/          # LLM, Rule, MCP folders (Scenarios)
│   │   └── tools/          # system tools.json, shared tools.json
│   │
│   └── step-definitions/ (Grouped by logic type)
│       ├── auth/           # login.steps.ts
│       ├── core/           # AgentCreation, JsonAgent, workflow steps
│       ├── scenarios/      # CreateRunDelete steps
│       ├── unified/        # UnifiedFramework.steps.ts (Primary framework)
│       └── validation/     # LLMValidation, RunValidation steps
```

## 🛠️ Configuration (.env)
Ensure your `.env` has:
- `BASE_URL`: The platform URL.
- `USER_ID` / `PASSWORD`: Automation credentials.
- `JUDGE_API_KEY`: (Optional) For LLM Judge semantic scoring.

## 🏃 Running Tests

- **Run the template:**
  ```bash
  npm run bdd:unified
  ```
- **Run in headed mode (to see the browser):**
  ```bash
  npx cross-env HEADED=1 npm run bdd:unified
  ```

(Add `"bdd:unified": "node --import tsx ./node_modules/@cucumber/cucumber/bin/cucumber-js bdd/features --import bdd/support/hooks.ts --import bdd/step-definitions/*.steps.ts --tags @unified_template"` to your `package.json` for convenience.)
