# Design Spec: Edit Deployment Connections + PR Notifications

**Date:** 2026-03-19
**Status:** Approved

---

## Overview

Two independent features added to Developer Buddy:

1. **Edit Deployment Connections** — users can edit the credentials or monitored pipelines of an existing connection in the Deployments panel without deleting and re-adding it.
2. **PR Notifications** — background polling fires OS-level Chrome notifications when an authored PR becomes ready to merge or when its checks start failing.

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

On `chrome.runtime.onInstalled`:
```
chrome.alarms.create('pr-notify', { periodInMinutes: 2 })
```

On `chrome.alarms.onAlarm`:
```
if (alarm.name === 'pr-notify') runPRNotifyPoll()
```

`runPRNotifyPoll()` steps:
1. Load `developer_buddy_github` — if no token/username, return early
2. Load `developer_buddy_pr_notifications` — if `enabled === false`, return early
3. Fetch authored open PRs via search API (`is:pr is:open author:{username}`)
4. For each non-draft PR, fetch `PRDetail` (mergeable_state + head.sha)
5. For PRs with state `unstable`, call check-runs API to determine if checks are pending or failing
6. Compare each PR's new state to its snapshot in `developer_buddy_pr_notify_state`
7. Fire notification for each **transition**:
   - `→ clean`: title "Ready to merge", message "{title} — {repo} #{number}"
   - `→ unstable (failing)`: title "Checks failing", message "{title} — {repo} #{number}"
8. Save updated snapshots back to `developer_buddy_pr_notify_state`

PRs not in the snapshot yet are recorded but do **not** trigger a notification on first encounter (avoids notification flood on first run or re-enable).

### Notification click

```typescript
chrome.notifications.onClicked.addListener((notificationId) => {
  // notificationId encodes the PR URL: "pr-notify:{url}"
  chrome.tabs.create({ url: extractUrlFromId(notificationId) });
});
```

Notification IDs use the format `pr-notify:{html_url}` so the click handler can open the correct PR without additional storage lookups.

### Opt-out toggle (SelfService.tsx)

A toggle row is added to the Pull Requests panel, below the tab bar and above the PR list:

```
[Bell / BellOff icon]  PR Notifications  [on/off pill toggle]
```

- Reads initial state from `developer_buddy_pr_notifications.enabled` (defaults to `true` if key absent)
- On toggle: writes new value to storage immediately
- Uses the same pill toggle style as other settings in the app

---

## Files Changed

| File | Change |
|---|---|
| `manifest.json` | Add `"alarms"` to permissions |
| `src/background/service-worker.ts` | Add alarm creation, poll cycle, notification click handler |
| `src/side-panel/modules/self-service/SelfService.tsx` | Add notification toggle row |
| `src/side-panel/modules/deployments/DeploymentsPanel.tsx` | Edit connection details + edit pipelines support in `AddConnectionForm`, `DeploymentsFeed`, `DeploymentsDashboard` |

---

## Error Handling

- If the poll cycle throws (network error, API error), catch silently and skip — no state is written, so the next poll will try again cleanly
- If a PR's detail fetch fails, skip that PR's snapshot update (don't overwrite last-known-good state)
- If GitHub is disconnected mid-poll, early return without clearing snapshots

## Out of Scope

- Notifications for PRs assigned for review
- Configurable poll interval
- Notification for other state transitions (e.g., `dirty` conflicts, `behind`)
- Jenkins/GitHub Actions deployment notifications
