# User Script CSP Fix Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox syntax for tracking.

**Goal:** Fix RPA user scripts failing on pages with strict Content Security Policy (e.g. GitHub) by replacing eval-based execution with chrome.userScripts.execute().

**Architecture:** The current tabs.onUpdated handler evaluates user script bodies by passing them as strings and running them dynamically in the page MAIN world. GitHub CSP blocks this as unsafe-eval. The fix uses chrome.userScripts.execute() (Chrome 135+) with world: USER_SCRIPT and configureWorld({ cspBypass: true }), which Chrome exempts from page CSP. Since USER_SCRIPT world is isolated from MAIN world, window.DB (set by grant-bridge) is invisible there. A self-contained DB shim is injected first in the same execute call, using the same DOM APIs: localStorage, navigator.clipboard, Notification, window.open.

**Tech Stack:** Chrome Extension MV3, chrome.userScripts API (Chrome 135+), TypeScript, @types/chrome ^0.1.37

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| manifest.json | Modify | Add userScripts permission |
| src/shared/utils/userScriptDbShim.ts | Create | Exports DB_SHIM_CODE string |
| src/background/service-worker.ts | Modify | configureWorld + replace eval block |

---

### Task 1: Add userScripts permission

**Files:**
- Modify: manifest.json

- [ ] Step 1: Add permission

In manifest.json, add "userScripts" after "alarms" in the permissions array:

  "permissions": [
    "storage", "tabs", "scripting", "sidePanel",
    "offscreen", "notifications", "clipboardWrite", "alarms",
    "userScripts"
  ]

- [ ] Step 2: Commit

  git add manifest.json
  git commit -m "feat: add userScripts permission for CSP-bypass script execution"

---

### Task 2: Create the DB shim module

**Files:**
- Create: src/shared/utils/userScriptDbShim.ts

Exports DB_SHIM_CODE - a string that defines window.DB in USER_SCRIPT world using only DOM APIs.
Known limitation: getActiveEnv() returns {} because __DB_ENV__ is MAIN-world-only.

- [ ] Step 1: Create src/shared/utils/userScriptDbShim.ts

The file should export a constant called DB_SHIM_CODE containing an IIFE that sets window.DB
with these methods (all using DOM APIs, no chrome.* calls):
  - setValue(key, value): localStorage.setItem with db_us_kv_ prefix + JSON.stringify
  - getValue(key): localStorage.getItem with prefix + JSON.parse, returns null if missing
  - deleteValue(key): localStorage.removeItem with prefix
  - openInTab(url): window.open(url, _blank)
  - setClipboard(text): navigator.clipboard.writeText with textarea execCommand fallback
  - notification(title, message): new Notification() if permission is granted
  - getActiveEnv(): returns {}
  - xmlhttpRequest(): logs Phase 2 message, returns null

- [ ] Step 2: Build to verify no TypeScript errors

  npm run build

Expected: no errors.

- [ ] Step 3: Commit

  git add src/shared/utils/userScriptDbShim.ts
  git commit -m "feat: add DB shim for USER_SCRIPT world execution"

---

### Task 3: Switch execution to chrome.userScripts.execute

**Files:**
- Modify: src/background/service-worker.ts

- [ ] Step 1: Import DB_SHIM_CODE

Add to imports at the top:

  import { DB_SHIM_CODE } from ../shared/utils/userScriptDbShim;

- [ ] Step 2: Add configureWorld at module scope

After the chrome.sidePanel.setPanelBehavior call (line 27):

  // Configure USER_SCRIPT world to bypass page CSP (e.g. GitHub blocks unsafe-eval).
  // Must be at module scope - does not persist across service worker restarts.
  chrome.userScripts.configureWorld({ cspBypass: true }).catch(console.error);

- [ ] Step 3: Replace the eval block in tabs.onUpdated

First, update the comment block above the tabs.onUpdated handler (lines 60-65). Replace:
  // This runs scripts in MAIN world via executeScript, which:
  //   1. Works even on pages with strict CSP (Google, etc.)
  //   2. Has full access to window/document/page globals
  //   3. Doesn't require chrome.storage in the page world
With:
  // Scripts run in USER_SCRIPT world via chrome.userScripts.execute().
  // The USER_SCRIPT world bypasses page CSP (cspBypass: true) and has access
  // to all DOM APIs. A DB shim is injected first to provide window.DB.

Then replace the entire chrome.scripting.executeScript(...) call and the const body line above it
(lines 91-107 in current service-worker.ts) with:

  chrome.userScripts.execute({
    target: { tabId },
    world: 'USER_SCRIPT',
    js: [{ code: DB_SHIM_CODE }, { code: script.body }],
  }).catch((err) => {
    console.warn(`[Developer Buddy] Failed to inject script "${script.name}":`, err);
  });

- [ ] Step 4: Handle types if needed

If the build fails with a type error on chrome.userScripts, add this before the imports:

  declare namespace chrome.userScripts {
    function configureWorld(config: { cspBypass?: boolean }): Promise<void>;
    function execute(injection: {
      target: { tabId: number; frameIds?: number[] };
      world?: "USER_SCRIPT" | "MAIN";
      js?: Array<{ code: string } | { file: string }>;
    }): Promise<unknown[]>;
  }

Only add if build fails on chrome.userScripts type errors.

- [ ] Step 5: Build

  npm run build

Expected: no errors, dist/ updated.

- [ ] Step 6: Verify on GitHub

1. chrome://extensions - reload Developer Buddy
2. Open a GitHub PR matching the Copy Branch script match pattern
3. Confirm button appears and copy works without CSP errors in console

- [ ] Step 7: Verify on a non-strict-CSP page

Open a page matching another user script. Confirm it still executes correctly.

- [ ] Step 8: Commit

  git add src/background/service-worker.ts
  git commit -m "fix: use chrome.userScripts.execute to bypass page CSP in RPA execution"
