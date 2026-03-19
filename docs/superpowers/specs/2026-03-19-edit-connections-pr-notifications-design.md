# Design Spec: Edit Deployment Connections + PR Notifications

**Date:** 2026-03-19
**Status:** Approved

---

## Overview

Three independent features added to Developer Buddy:

1. **Edit Deployment Connections** — users can edit the credentials or monitored pipelines of an existing connection in the Deployments panel without deleting and re-adding it.
2. **PR Notifications** — background polling fires OS-level Chrome notifications when an authored PR changes merge state (ready to merge, checks failing, conflicts, branch behind).
3. **Deployment Notifications** — background polling fires OS-level Chrome notifications when a monitored GitHub Actions or Jenkins run transitions to success or failure.

---

## Feature 1: Edit Deployment Connections

### Problem

Currently, the only way to change a deployment connection is to delete it and re-add it. Users need the ability to edit credentials (URL, token) and pipeline selections independently.

### UX: Connection group header

Each connection section header in `DeploymentsFeed` gains two icon buttons on hover, sitting alongside the existing `Trash2` remove button:

```
[connection label]  ···  [Settings2]  [Pencil]  [Trash2]
                         edit details  edit pipes  remove
```

- `Settings2` (lucide) → Edit connection details
- `Pencil` (lucide) → Edit pipelines/workflows
- `Trash2` → Remove (existing, unchanged)

All three are hidden by default and revealed on `group-hover` of the header row.

### Edit connection details

Opens `AddConnectionForm` in edit mode at **Step 1**, pre-populated:

- Provider selector is **disabled** (type cannot change for an existing connection)
- GitHub Actions: `repo` field pre-filled
- Jenkins: `url`, `username`, `token` fields pre-filled (token shown as placeholder dots)
- "Load Pipelines →" fetches a fresh pipeline list, then advances to **Step 2** with existing `selectedWorkflows` / `selectedJobs` pre-checked
- On Save: **replaces** the connection in-place (same `id`), persists config, triggers feed refresh

### Edit pipelines

Opens `AddConnectionForm` in edit mode at **Step 2** directly:

- Immediately fetches fresh pipeline list for the connection (shows inline spinner while loading)
- Pre-checks workflows or jobs that are currently saved in the connection
- User adjusts selection and clicks Save → updates connection in-place (same `id`), persists, triggers feed refresh
- "← Back" returns to Step 1 (same as normal add flow, but provider field disabled)

### Data flow

`DeploymentsFeed` calls `onEditConnection(id, mode: 'details' | 'pipelines')` → `DeploymentsDashboard` sets `editingConnection` state → renders `AddConnectionForm` in edit mode instead of `DeploymentsFeed`. On save, dashboard replaces the matching entry in `config.connections` by `id`.

### AddConnectionForm changes

`AddConnectionForm` accepts two new optional props:
- `existingConnection?: DeploymentConnection` — if set, form is in edit mode
- `initialStep?: 1 | 2` — which step to start on (default `1`)

When `existingConnection` is provided:
- Step 1 fields are pre-populated
- Provider selector is disabled
- On save, the returned connection object retains the same `id`

---

## Feature 2: PR Notifications

### Problem

Developers must manually open the side panel to check if a PR is ready to merge or if checks have failed. They want proactive OS-level notifications so they can act immediately.

### Scope

- Authored PRs only (not PRs assigned for review)
- Notifications fire on state **transitions** only (no repeat notifications for unchanged state)
- Opt-out toggle in the Pull Requests panel; notifications are **on by default**

### Manifest changes

Add `"alarms"` to the `permissions` array in `manifest.json`.

### Storage schema

Two new storage keys:

```typescript
// 'developer_buddy_pr_notifications' — user settings
interface PRNotificationSettings {
  enabled: boolean;  // default: true
}

// 'developer_buddy_pr_notify_state' — internal snapshot (not shown in UI)
interface PRNotificationState {
  snapshots: Record<string, PRSnapshot>;  // key: "{owner}/{repo}#{number}"
}

interface PRSnapshot {
  mergeState: string;       // last known mergeable_state value
  checksFailing: boolean;   // true when unstable + no pending runs
}
```

### Background polling (service-worker.ts)

On `chrome.runtime.onInstalled`, clear any legacy alarm name and create `'buddy-notify'` only if it does not already exist:
```typescript
chrome.alarms.clear('pr-notify'); // remove any alarm from a prior version
chrome.alarms.get('buddy-notify', (existing) => {
  if (!existing) chrome.alarms.create('buddy-notify', { periodInMinutes: 2 });
});
```

On `chrome.alarms.onAlarm`:
```
if (alarm.name === 'buddy-notify') {
  runPRNotifyPoll();
  runDeployNotifyPoll();
}
```

`runPRNotifyPoll()` steps:
1. Load `developer_buddy_github` — if no token/username, return early
2. Load `developer_buddy_pr_notifications` — if `enabled === false`, return early
3. Fetch authored open PRs via search API (`is:pr is:open author:{username}`)
4. For each non-draft PR, fetch `PRDetail` (mergeable_state + head.sha)
5. For PRs with state `unstable`, call check-runs API to determine if checks are pending or failing
6. Load current `developer_buddy_pr_notify_state` snapshot
7. Compare each PR's new state to its snapshot — fire notification for each **transition**:
   - `→ clean`: title "Ready to merge", message "{title} — {repo} #{number}"
   - `→ unstable (failing)`: title "Checks failing", message "{title} — {repo} #{number}"
   - `→ dirty`: title "Merge conflict", message "{title} — {repo} #{number}"
   - `→ behind`: title "Branch behind", message "{title} — {repo} #{number}"
8. Build updated snapshot from **only the currently open PRs** (prunes closed/merged PRs automatically — keys not in the current search result are dropped)
9. Save updated snapshots back to `developer_buddy_pr_notify_state`

PRs not in the snapshot yet are recorded but do **not** trigger a notification on first encounter (avoids notification flood on first run or re-enable).

**Snapshot pruning:** The snapshot is rebuilt each poll from only the PRs returned by the current search query. Any PR that has been closed, merged, or otherwise removed from the authored-open list is automatically pruned, preventing unbounded storage growth.

### Notification creation

Notifications are created directly via `chrome.notifications.create` (not via the existing `handleNotification` helper) so that a custom notification ID can be passed and used in the click handler:

```typescript
chrome.notifications.create(`pr-notify:${pr.html_url}`, {
  type: 'basic',
  iconUrl: chrome.runtime.getURL('icons/icon48.png'),
  title,
  message,
});
```

### Notification click

```typescript
chrome.notifications.onClicked.addListener((notificationId) => {
  // IDs are formatted as "{prefix}:{url}" — strip everything up to and including the first ":"
  const url = notificationId.slice(notificationId.indexOf(':') + 1);
  if (url.startsWith('http')) chrome.tabs.create({ url });
});
```

Notification IDs use the format `{prefix}:{html_url}` — e.g. `pr-notify:https://github.com/...` or `deploy-notify:https://...`. Stripping up to the first `:` recovers the URL generically for both prefixes without hard-coding either string.

### Opt-out toggle (SelfService.tsx)

A toggle row is added to the Pull Requests panel, **above the tab bar** (above the "My PRs / Review / Merged" tabs), so it applies globally regardless of which tab is active:

```
[Bell / BellOff icon]  PR Notifications  [on/off pill toggle]
```

- Reads initial state from `developer_buddy_pr_notifications.enabled` (defaults to `true` if key absent)
- On toggle: writes new value to storage immediately
- Uses the same pill toggle style as other settings in the app

---

## Feature 3: Deployment Notifications

### Problem

Developers want to know immediately when a monitored GitHub Actions workflow or Jenkins job completes — success or failure — without having to open the Deployments panel.

### Scope

- Covers all connections configured in `developer_buddy_deployments`
- Fires on state **transitions** only (no repeat notifications for unchanged state)
- Notifies on: `in_progress → success`, `in_progress → failure`, new run appearing as `failure`
- Does **not** notify when a new run appears as `success` (avoids noise for already-completed runs discovered on first poll)
- Opt-out toggle in the Deployments panel; notifications are **on by default**

### Storage schema

```typescript
// 'developer_buddy_deploy_notifications' — user settings
interface DeployNotificationSettings {
  enabled: boolean;  // default: true
}

// 'developer_buddy_deploy_notify_state' — internal snapshot (not shown in UI)
interface DeployNotificationState {
  snapshots: Record<string, DeploySnapshot>;  // key: item.id (e.g. "gh-12345678")
}

interface DeploySnapshot {
  status: 'success' | 'failure' | 'in_progress' | 'cancelled' | 'unknown';
  connectionLabel: string;
  runName: string;
  buildRef: string;
  url: string;
}
```

### Background polling

The `'buddy-notify'` alarm (established in Feature 2) triggers both `runPRNotifyPoll()` and `runDeployNotifyPoll()` — no additional alarm is needed.

**Shared fetch module:** `fetchAllConnections` and its full dependency chain (`fetchGitHubRuns`, `fetchJenkinsBuilds`, `mapGitHubStatus`, `mapJenkinsStatus`, `jenkinsJobPath`, `jenkinsAuthHeaders`) must be extracted from `DeploymentsPanel.tsx` into a new shared module:

```
src/shared/deployments/deploymentFetcher.ts
```

This module exports `fetchAllConnections`, `DeploymentItem`, and the connection types. `DeploymentsPanel.tsx` imports from this module instead of defining them inline. The service worker also imports from this module to run the deployment poll.

`runDeployNotifyPoll()` steps:
1. Load `developer_buddy_deployments` — if no connections, return early
2. Load `developer_buddy_deploy_notifications` — if `enabled === false`, return early
3. Load GitHub token from `developer_buddy_github` (for GitHub Actions connections)
4. Call `fetchAllConnections(connections, githubToken)` (imported from `src/shared/deployments/deploymentFetcher.ts`) to get current `DeploymentItem[]`
5. Load current `developer_buddy_deploy_notify_state` snapshot
6. For each item, compare to its snapshot and fire notification for transitions:
   - New item with `failure` → notify "Deployment failed: {runName} ({buildRef}) — {connectionLabel}"
   - `in_progress → success` → notify "Deployment succeeded: {runName} ({buildRef}) — {connectionLabel}"
   - `in_progress → failure` → notify "Deployment failed: {runName} ({buildRef}) — {connectionLabel}"
7. Rebuild snapshot from **only the items returned in the current poll** (prunes stale entries automatically)
8. Save updated snapshot to `developer_buddy_deploy_notify_state`

### Notification creation

Same pattern as PR notifications — direct `chrome.notifications.create` with a custom ID:

```typescript
chrome.notifications.create(`deploy-notify:${item.url}`, {
  type: 'basic',
  iconUrl: chrome.runtime.getURL('icons/icon48.png'),
  title,
  message,
});
```

The `chrome.notifications.onClicked` handler already strips the prefix and opens the URL in a new tab. It handles both `pr-notify:` and `deploy-notify:` prefixes.

### Opt-out toggle (DeploymentsPanel.tsx)

A toggle row is added to `DeploymentsDashboard`, between the header row and the feed:

```
[Bell / BellOff icon]  Deployment Notifications  [on/off pill toggle]
```

- Reads initial state from `developer_buddy_deploy_notifications.enabled` (defaults to `true` if absent)
- On toggle: writes new value to storage immediately
- Hidden when the `AddConnectionForm` is open

---

## Files Changed

| File | Change |
|---|---|
| `manifest.json` | Add `"alarms"` to permissions |
| `src/shared/deployments/deploymentFetcher.ts` | **New** — extract `fetchAllConnections` + types from `DeploymentsPanel.tsx` into shared module |
| `src/background/service-worker.ts` | Add `'buddy-notify'` alarm, PR poll cycle, deployment poll cycle, notification click handler |
| `src/side-panel/modules/self-service/SelfService.tsx` | Add PR notification toggle row (above tab bar) |
| `src/side-panel/modules/deployments/DeploymentsPanel.tsx` | Import from shared module; edit connection support in `AddConnectionForm`, `DeploymentsFeed`, `DeploymentsDashboard`; add deployment notification toggle row |

---

## Error Handling

- If the poll cycle throws (network error, API error), catch silently and skip — no state is written, so the next poll will try again cleanly
- If a PR's detail fetch fails, skip that PR's snapshot update (don't overwrite last-known-good state)
- If GitHub is disconnected mid-poll, early return without clearing snapshots

## Out of Scope

- Notifications for PRs assigned for review
- Configurable poll interval
