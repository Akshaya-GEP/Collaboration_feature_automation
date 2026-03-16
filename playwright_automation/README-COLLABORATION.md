# Running the Collaboration Test

This guide explains how to run the collaboration test that uses two browsers (Chrome and Edge) on the same canvas.

**Test file:** `tests/dashboard/collaboration.spec.ts`

---

## Prerequisites

- Node.js (v18 or later recommended)
- npm

---

## Setup

From the `playwright_automation` folder:

### 1. Install dependencies

```bash
npm install
```

### 2. Install Playwright browsers

Install the browser binaries (Chromium, etc.) required by Playwright:

```bash
npx playwright install
```

To install only Chromium and the Edge channel used by the collaboration test:

```bash
npx playwright install chromium
npx playwright install msedge
```

---

## Run the collaboration test

**Headless (default):**

```bash
npx playwright test tests/dashboard/collaboration.spec.ts
```

**Headed (see both browsers):**

```bash
npx playwright test tests/dashboard/collaboration.spec.ts --headed
```

Or use the `HEADED` env var:

```bash
HEADED=1 npx playwright test tests/dashboard/collaboration.spec.ts
```

---

## Environment variables

Configure in a `.env` file in `playwright_automation` (or export in the shell):

| Variable | Description |
|----------|-------------|
| `USER_EMAIL_B` or `USER_B_EMAIL` | **Required.** User B email for the invite step (placeholder "name@gep.com") and Browser B login. |
| `USER_PASSWORD_B` or `USER_B_PASSWORD` | Required for Browser B if not using saved auth (e.g. first run to create `authB.json`). |
| `APP_URL` | Application URL (defaults to dev-qi URL if not set). |
| `HEADED` | Set to `1` to run with visible browsers. |
| `SCREEN_WIDTH` / `SCREEN_HEIGHT` | For 50–50 split in headed mode (default 1920×1080). |
| `COLLAB_WORKFLOW_NAME` | Workflow name (default: `BDD AGENT`). |
| `COLLAB_WORKFLOW_JSON` | Path to workflow JSON (default: `bdd/data/core/agent_testcase1.json`). |

After the first run with Browser B credentials, Playwright can save auth to `authB.json` so you don’t need to pass the password every time.

---

## Quick reference

```bash
cd playwright_automation
npm install
npx playwright install
npx playwright test tests/dashboard/collaboration.spec.ts
```

For a visible run:

```bash
HEADED=1 npx playwright test tests/dashboard/collaboration.spec.ts
```
