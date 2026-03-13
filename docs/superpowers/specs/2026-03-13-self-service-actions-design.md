# Self-Service Actions — Design Spec

**Date:** 2026-03-13
**Status:** Approved

---

## Overview

Add configurable one-click action buttons to Developer Buddy. Actions are preconfigured HTTP requests (webhooks, REST calls) that a developer defines once in the settings page and triggers from a dedicated side panel tab. The result (status + truncated response body) is shown inline after each trigger.

---

## User-Facing Surfaces

### 1. Settings Page — New "Actions" Nav Section

A single nav item labelled **Actions** added to the options sidebar. The page has two stacked subsections:

**Action Variables (top)**
- A shared key-value store available to all actions via `{{VAR_NAME}}` interpolation
- Each variable has: `key`, `value`, `secret` (boolean — masks value in the UI)
- Inline add/delete rows; save on each row change
- Example use: `DEPLOY_HOOK_URL`, `API_TOKEN`

**Actions List (bottom)**
- List of defined actions, each showing method badge + name + URL preview
- "New Action" button → replaces list with inline editor (same pattern as `EnvProfileEditor`)
- Pencil/trash icons per row for edit/delete

**Action Editor (inline, replaces list)**
Fields:
- **Name** — display label shown on the trigger button
- **Method** — dropdown: GET · POST · PUT · PATCH · DELETE
- **URL** — supports `{{VAR_NAME}}` interpolation from Action Variables
- **Headers** — key/value table with enabled toggle per row; values support `{{VAR_NAME}}`
- **Body** — raw textarea (JSON); shown only for POST / PUT / PATCH; supports `{{VAR_NAME}}`
- **Confirmation prompt** — optional free text; if non-empty, an inline confirm dialog appears before the request fires; if blank, action fires immediately on click

Cancel / Save Action buttons.

---

### 2. Side Panel — New "Actions" Tab

A new top-level tab in the side panel nav alongside RPA, API, PRs, etc.

Each action renders as a button row inside a card. Three states per action card:

**Idle** — button showing method badge + action name. Click fires immediately (no confirmation) or expands the confirmation UI.

**Confirmation expanded** (when action has a confirmation prompt) — card expands inline beneath the button showing the prompt text and Confirm / Cancel buttons. Confirm fires the request; Cancel collapses back to idle.

**Result** — after the request completes, the card shows:
- Status code + status text (coloured: green for 2xx, red for 4xx/5xx)
- Response time in ms
- Truncated response body (first 300 chars, monospace, in a subtle inset box)
- Clicking the button again re-triggers (resets to idle first)

**Empty state** — if no actions are defined, a hint links to Settings → Actions.

---

## Data Model

### `ActionVariable`

```ts
interface ActionVariable {
  key: string;
  value: string;
  secret: boolean;
}
```

### `SelfServiceAction`

```ts
interface SelfServiceAction {
  id: string;
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  headers: { key: string; value: string; enabled: boolean }[];
  body: string;               // empty string = no body
  confirmationPrompt: string; // empty string = no confirmation
  createdAt: string;          // ISO8601
  updatedAt: string;          // ISO8601
}
```

### Storage

Both are added to `StorageSchema` (stored under `developer_buddy_data`) so they are included in import/export automatically:

```ts
interface StorageSchema {
  // ...existing fields...
  selfServiceActions: SelfServiceAction[];
  actionVariables: ActionVariable[];
}
```

`StorageService.ts` has **two** places that must be updated — the top-level `DEFAULTS` constant and the inline fallback object inside `readAll()` (used when the storage key does not yet exist). Both must include `selfServiceActions: []` and `actionVariables: []`. Missing either will cause a runtime crash on first load.

---

## Interpolation

Action URLs, header values, and body text support `{{VAR_NAME}}` interpolation using the existing `interpolate()` utility. `interpolate()` accepts an `EnvProfile | null`. Since `ActionVariable` is structurally identical to `EnvVariable` (`key`, `value`, `secret`), a synthetic `EnvProfile` is constructed on the fly before calling it:

```ts
const syntheticProfile: EnvProfile = {
  id: '',
  name: 'action-variables',
  isActive: true,
  variables: actionVariables, // ActionVariable[] is structurally compatible with EnvVariable[]
};
interpolate(template, syntheticProfile);
```

No changes to `interpolate()` are needed. This reuses the exact same interpolation path as the API tester.

---

## Request Execution

Actions are fired directly from the side panel using `fetch()` — no background service worker involvement needed. The flow:

1. Interpolate URL, headers, body with action variables
2. Build `RequestInit` from method, enabled headers, body (POST / PUT / PATCH only — body excluded for GET and DELETE, consistent with `requestRunner.ts`)
3. `fetch()` with a timeout (10 seconds)
4. Read `response.status`, `response.statusText`, elapsed time, and `response.text()` (truncated to 300 chars for display)
5. Render result inline; errors (network failure, timeout) shown as red error state

---

## Files Affected

| File | Change |
|---|---|
| `src/shared/types/index.ts` | Add `ActionVariable`, `SelfServiceAction`, extend `StorageSchema` |
| `src/shared/storage/StorageService.ts` | Add CRUD methods for `selfServiceActions` and `actionVariables` |
| `src/options/modules/actions/ActionsManager.tsx` | New — settings page component (variables table + actions list + inline editor) |
| `src/options/App.tsx` | Add `'actions'` to `Section` type and `NAV` array; render `<ActionsManager />` |
| `src/side-panel/modules/actions/ActionsPanel.tsx` | New — side panel tab (action buttons, confirmation, result display) |
| `src/side-panel/App.tsx` | Add Actions tab to side panel nav |

---

## Out of Scope

- No icon picker per action (name + method badge is sufficient for v1)
- No response body formatting / pretty-printing (raw truncated text only)
- No run history / log
- No GitLab or other integrations (this is purely custom HTTP actions)
- No enterprise push/lock of actions (Phase 3 concern)
