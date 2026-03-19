# Edit Connections + PR & Deployment Notifications Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add edit-in-place for deployment connections, background OS notifications for PR state changes (ready/conflicts/failing/behind), and background OS notifications for deployment run completions.

**Architecture:** Extract shared deployment fetch logic into `src/shared/deployments/deploymentFetcher.ts` so both the side panel and the background service worker can use it. A single `buddy-notify` Chrome alarm (2 min) drives two independent poll functions — one for PRs, one for deployments. Pure notification-decision functions are extracted and unit-tested. All UI changes follow existing Tailwind + React patterns.

**Tech Stack:** React 18, TypeScript, Webpack 5 (each entry bundles its shared imports inline), Tailwind CSS v3, Chrome MV3 (`chrome.alarms`, `chrome.notifications`), Jest + ts-jest

**Spec:** `docs/superpowers/specs/2026-03-19-edit-connections-pr-notifications-design.md`

---

## Chunk 1: Shared modules + tests

### Task 1: Create `src/shared/deployments/deploymentFetcher.ts`

Extract all types and fetch functions from `DeploymentsPanel.tsx` into a shared module that both the panel and the service worker can import.

**Files:**
- Create: `src/shared/deployments/deploymentFetcher.ts`
- Modify: `src/side-panel/modules/deployments/DeploymentsPanel.tsx` (remove extracted code, add imports)

- [ ] **Step 1: Create the shared module**

Create `src/shared/deployments/deploymentFetcher.ts` with the following content:

```typescript
// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GitHubActionsConnection {
  id: string;
  type: 'github_actions';
  label: string;
  repo: string;
  selectedWorkflows: Array<{ id: number; name: string; path: string }>;
}

export interface JenkinsConnection {
  id: string;
  type: 'jenkins';
  label: string;
  url: string;
  username?: string;
  token?: string;
  selectedJobs: Array<{ name: string; displayName: string }>;
}

export type DeploymentConnection = GitHubActionsConnection | JenkinsConnection;

export interface DeploymentsConfig {
  connections: DeploymentConnection[];
}

export interface DeploymentItem {
  id: string;
  connectionId: string;
  provider: 'github_actions' | 'jenkins';
  connectionLabel: string;
  runName: string;
  buildRef: string;
  status: 'success' | 'failure' | 'in_progress' | 'cancelled' | 'unknown';
  timestamp: string;
  url: string;
}

export interface ConnectionError {
  connectionId: string;
  connectionLabel: string;
  message: string;
}

export interface DeploySnapshot {
  status: DeploymentItem['status'];
  connectionLabel: string;
  runName: string;
  buildRef: string;
  url: string;
}

// ---------------------------------------------------------------------------
// GitHub Actions API
// ---------------------------------------------------------------------------

export function mapGitHubStatus(run: {
  status: string;
  conclusion: string | null;
}): DeploymentItem['status'] {
  if (run.status === 'in_progress' || run.status === 'queued') return 'in_progress';
  if (run.status === 'completed') {
    if (run.conclusion === 'success') return 'success';
    if (run.conclusion === 'failure' || run.conclusion === 'timed_out') return 'failure';
    if (run.conclusion === 'cancelled') return 'cancelled';
  }
  return 'unknown';
}

export async function fetchGitHubRuns(
  repo: string,
  workflowId: number,
  token: string,
  connectionId: string,
  connectionLabel: string,
): Promise<DeploymentItem[]> {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/actions/runs?workflow_id=${workflowId}&per_page=5`,
    {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    },
  );
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  const data = await res.json();
  return (data.workflow_runs ?? []).map(
    (run: {
      id: number;
      name?: string;
      display_title?: string;
      head_branch?: string;
      created_at?: string;
      run_started_at?: string;
      html_url: string;
      status: string;
      conclusion: string | null;
    }) => ({
      id: `gh-${run.id}`,
      connectionId,
      provider: 'github_actions' as const,
      connectionLabel,
      runName: run.name ?? run.display_title ?? 'Workflow run',
      buildRef: run.head_branch ?? 'unknown',
      status: mapGitHubStatus(run),
      timestamp: run.created_at ?? run.run_started_at ?? new Date().toISOString(),
      url: run.html_url,
    }),
  );
}

// ---------------------------------------------------------------------------
// Jenkins API
// ---------------------------------------------------------------------------

export function jenkinsJobPath(name: string): string {
  return name
    .split('/')
    .map((segment) => `job/${segment}`)
    .join('/');
}

export function jenkinsAuthHeaders(
  username?: string,
  token?: string,
): Record<string, string> {
  if (username && token) {
    return { Authorization: `Basic ${btoa(`${username}:${token}`)}` };
  }
  return {};
}

export function mapJenkinsStatus(build: {
  building: boolean;
  result: string | null;
}): DeploymentItem['status'] {
  if (build.building) return 'in_progress';
  if (build.result === 'SUCCESS') return 'success';
  if (build.result === 'FAILURE' || build.result === 'UNSTABLE') return 'failure';
  if (build.result === 'ABORTED') return 'cancelled';
  return 'unknown';
}

export async function fetchJenkinsBuilds(
  conn: JenkinsConnection,
  job: { name: string; displayName: string },
): Promise<DeploymentItem[]> {
  const baseUrl = conn.url.replace(/\/$/, '');
  const jobPath = jenkinsJobPath(job.name);
  const apiUrl = `${baseUrl}/${jobPath}/api/json?tree=builds[number,result,timestamp,duration,url,building,displayName]{0,5}`;
  const res = await fetch(apiUrl, { headers: jenkinsAuthHeaders(conn.username, conn.token) });
  if (!res.ok) throw new Error(`Jenkins API error: ${res.status}`);
  const data = await res.json();
  return (data.builds ?? []).map(
    (build: {
      number: number;
      result: string | null;
      timestamp: number;
      url: string;
      building: boolean;
    }) => ({
      id: `jenkins-${conn.id}-${job.name}-${build.number}`,
      connectionId: conn.id,
      provider: 'jenkins' as const,
      connectionLabel: conn.label,
      runName: job.displayName,
      buildRef: `#${build.number}`,
      status: mapJenkinsStatus(build),
      timestamp: new Date(build.timestamp).toISOString(),
      url: build.url,
    }),
  );
}

// ---------------------------------------------------------------------------
// Fetch all connections
// ---------------------------------------------------------------------------

export async function fetchAllConnections(
  connections: DeploymentConnection[],
  githubToken: string | null,
): Promise<{ items: DeploymentItem[]; errors: ConnectionError[] }> {
  const tasks: Array<Promise<DeploymentItem[]>> = [];
  const taskMeta: Array<{ connectionId: string; connectionLabel: string }> = [];

  for (const conn of connections) {
    if (conn.type === 'github_actions') {
      if (!githubToken) {
        tasks.push(
          Promise.reject(
            new Error('GitHub not configured — connect in the Pull Requests tab.'),
          ),
        );
        taskMeta.push({ connectionId: conn.id, connectionLabel: conn.label });
      } else {
        for (const wf of conn.selectedWorkflows) {
          tasks.push(fetchGitHubRuns(conn.repo, wf.id, githubToken, conn.id, conn.label));
          taskMeta.push({ connectionId: conn.id, connectionLabel: conn.label });
        }
      }
    } else if (conn.type === 'jenkins') {
      for (const job of conn.selectedJobs) {
        tasks.push(fetchJenkinsBuilds(conn, job));
        taskMeta.push({ connectionId: conn.id, connectionLabel: conn.label });
      }
    }
  }

  const results = await Promise.allSettled(tasks);
  const items: DeploymentItem[] = [];
  const errorMap = new Map<string, ConnectionError>();

  results.forEach((result, i) => {
    const meta = taskMeta[i];
    if (result.status === 'fulfilled') {
      items.push(...result.value);
    } else {
      if (!errorMap.has(meta.connectionId)) {
        errorMap.set(meta.connectionId, {
          connectionId: meta.connectionId,
          connectionLabel: meta.connectionLabel,
          message: (result.reason as Error)?.message ?? 'Unknown error',
        });
      }
    }
  });

  items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return { items, errors: Array.from(errorMap.values()) };
}

// ---------------------------------------------------------------------------
// Deployment notification logic
// ---------------------------------------------------------------------------

export function getDeployNotificationMessage(
  item: DeploymentItem,
  oldSnapshot: DeploySnapshot | undefined,
): { title: string; message: string } | null {
  const msg = `${item.runName} (${item.buildRef}) — ${item.connectionLabel}`;
  const oldStatus = oldSnapshot?.status;

  // New item that is already failing — notify immediately
  if (!oldSnapshot && item.status === 'failure') {
    return { title: 'Deployment failed', message: msg };
  }
  // Transition in_progress → success
  if (oldStatus === 'in_progress' && item.status === 'success') {
    return { title: 'Deployment succeeded', message: msg };
  }
  // Transition in_progress → failure
  if (oldStatus === 'in_progress' && item.status === 'failure') {
    return { title: 'Deployment failed', message: msg };
  }
  return null;
}
```

- [ ] **Step 2: Update `DeploymentsPanel.tsx` to import from shared module**

In `src/side-panel/modules/deployments/DeploymentsPanel.tsx`:

1. Add import at the top (after the React import):
```typescript
import {
  type GitHubActionsConnection,
  type JenkinsConnection,
  type DeploymentConnection,
  type DeploymentItem,
  type ConnectionError,
  fetchAllConnections,
  fetchGitHubRuns,
  fetchJenkinsBuilds,
  mapGitHubStatus,
  mapJenkinsStatus,
  jenkinsJobPath,
  jenkinsAuthHeaders,
} from '../../../shared/deployments/deploymentFetcher';
```

2. Remove from `DeploymentsPanel.tsx` the following (now provided by the shared module):
   - `GitHubActionsConnection` interface
   - `JenkinsConnection` interface
   - `DeploymentConnection` type
   - `DeploymentItem` interface
   - `ConnectionError` interface
   - `mapGitHubStatus` function
   - `fetchGitHubRuns` function
   - `jenkinsJobPath` function
   - `jenkinsAuthHeaders` function
   - `mapJenkinsStatus` function
   - `fetchJenkinsBuilds` function
   - `fetchAllConnections` function

Keep in `DeploymentsPanel.tsx` (panel-only):
   - `fetchDeploymentsConfig`, `saveDeploymentsConfig`, `fetchGitHubToken` (storage helpers)
   - `fetchGitHubWorkflows`, `fetchJenkinsJobs` (used only in `AddConnectionForm`)
   - All React components

- [ ] **Step 3: Verify the build still passes**

```bash
cd E:/work/developer-buddy && npm run build 2>&1 | tail -5
```
Expected: `compiled successfully`

- [ ] **Step 4: Commit**

```bash
git add src/shared/deployments/deploymentFetcher.ts src/side-panel/modules/deployments/DeploymentsPanel.tsx
git commit -m "refactor(deployments): extract shared fetch logic to deploymentFetcher.ts"
```

---

### Task 2: Create `src/shared/pr/prNotificationLogic.ts` + tests

**Files:**
- Create: `src/shared/pr/prNotificationLogic.ts`
- Create: `tests/shared/prNotificationLogic.test.ts`
- Create: `tests/shared/deploymentFetcher.test.ts`

- [ ] **Step 1: Write the failing tests for `prNotificationLogic`**

Create `tests/shared/prNotificationLogic.test.ts`:

```typescript
import { getPRNotificationMessage, type PRSnapshot } from '../../src/shared/pr/prNotificationLogic';

describe('getPRNotificationMessage', () => {
  const base = { prTitle: 'Fix bug', repoName: 'owner/repo', prNumber: 42 };

  it('does not notify on first encounter (no snapshot) regardless of state', () => {
    expect(getPRNotificationMessage('clean', false, undefined, base.prTitle, base.repoName, base.prNumber)).toBeNull();
    expect(getPRNotificationMessage('dirty', false, undefined, base.prTitle, base.repoName, base.prNumber)).toBeNull();
    expect(getPRNotificationMessage('behind', false, undefined, base.prTitle, base.repoName, base.prNumber)).toBeNull();
    expect(getPRNotificationMessage('unstable', true, undefined, base.prTitle, base.repoName, base.prNumber)).toBeNull();
  });

  it('notifies ready to merge when transitioning from another state to clean', () => {
    const old: PRSnapshot = { mergeState: 'unstable', checksFailing: true };
    const result = getPRNotificationMessage('clean', false, old, base.prTitle, base.repoName, base.prNumber);
    expect(result).toEqual({ title: 'Ready to merge', message: 'Fix bug — owner/repo #42' });
  });

  it('does not notify when already clean', () => {
    const old: PRSnapshot = { mergeState: 'clean', checksFailing: false };
    expect(getPRNotificationMessage('clean', false, old, base.prTitle, base.repoName, base.prNumber)).toBeNull();
  });

  it('notifies checks failing when transitioning to unstable+failing', () => {
    const old: PRSnapshot = { mergeState: 'clean', checksFailing: false };
    const result = getPRNotificationMessage('unstable', true, old, base.prTitle, base.repoName, base.prNumber);
    expect(result?.title).toBe('Checks failing');
    expect(result?.message).toBe('Fix bug — owner/repo #42');
  });

  it('does not notify for unstable when checks are still pending (not failing)', () => {
    expect(getPRNotificationMessage('unstable', false, undefined, base.prTitle, base.repoName, base.prNumber)).toBeNull();
  });

  it('does not notify when already in checksFailing state', () => {
    const old: PRSnapshot = { mergeState: 'unstable', checksFailing: true };
    expect(getPRNotificationMessage('unstable', true, old, base.prTitle, base.repoName, base.prNumber)).toBeNull();
  });

  it('notifies merge conflict on → dirty', () => {
    const old: PRSnapshot = { mergeState: 'clean', checksFailing: false };
    const result = getPRNotificationMessage('dirty', false, old, base.prTitle, base.repoName, base.prNumber);
    expect(result?.title).toBe('Merge conflict');
  });

  it('does not notify when already dirty', () => {
    const old: PRSnapshot = { mergeState: 'dirty', checksFailing: false };
    expect(getPRNotificationMessage('dirty', false, old, base.prTitle, base.repoName, base.prNumber)).toBeNull();
  });

  it('notifies branch behind on → behind', () => {
    const old: PRSnapshot = { mergeState: 'clean', checksFailing: false };
    const result = getPRNotificationMessage('behind', false, old, base.prTitle, base.repoName, base.prNumber);
    expect(result?.title).toBe('Branch behind');
  });

  it('does not notify when already behind', () => {
    const old: PRSnapshot = { mergeState: 'behind', checksFailing: false };
    expect(getPRNotificationMessage('behind', false, old, base.prTitle, base.repoName, base.prNumber)).toBeNull();
  });

});
```

- [ ] **Step 2: Write the failing tests for `deploymentFetcher`**

Create `tests/shared/deploymentFetcher.test.ts`:

```typescript
import {
  mapGitHubStatus,
  mapJenkinsStatus,
  getDeployNotificationMessage,
  jenkinsJobPath,
  type DeploymentItem,
  type DeploySnapshot,
} from '../../src/shared/deployments/deploymentFetcher';

describe('mapGitHubStatus', () => {
  it('returns in_progress for in_progress status', () => {
    expect(mapGitHubStatus({ status: 'in_progress', conclusion: null })).toBe('in_progress');
  });
  it('returns in_progress for queued status', () => {
    expect(mapGitHubStatus({ status: 'queued', conclusion: null })).toBe('in_progress');
  });
  it('returns success for completed+success', () => {
    expect(mapGitHubStatus({ status: 'completed', conclusion: 'success' })).toBe('success');
  });
  it('returns failure for completed+failure', () => {
    expect(mapGitHubStatus({ status: 'completed', conclusion: 'failure' })).toBe('failure');
  });
  it('returns failure for completed+timed_out', () => {
    expect(mapGitHubStatus({ status: 'completed', conclusion: 'timed_out' })).toBe('failure');
  });
  it('returns cancelled for completed+cancelled', () => {
    expect(mapGitHubStatus({ status: 'completed', conclusion: 'cancelled' })).toBe('cancelled');
  });
  it('returns unknown for completed with unknown conclusion', () => {
    expect(mapGitHubStatus({ status: 'completed', conclusion: null })).toBe('unknown');
  });
});

describe('mapJenkinsStatus', () => {
  it('returns in_progress when building', () => {
    expect(mapJenkinsStatus({ building: true, result: null })).toBe('in_progress');
  });
  it('returns success for SUCCESS', () => {
    expect(mapJenkinsStatus({ building: false, result: 'SUCCESS' })).toBe('success');
  });
  it('returns failure for FAILURE', () => {
    expect(mapJenkinsStatus({ building: false, result: 'FAILURE' })).toBe('failure');
  });
  it('returns failure for UNSTABLE', () => {
    expect(mapJenkinsStatus({ building: false, result: 'UNSTABLE' })).toBe('failure');
  });
  it('returns cancelled for ABORTED', () => {
    expect(mapJenkinsStatus({ building: false, result: 'ABORTED' })).toBe('cancelled');
  });
  it('returns unknown for null result', () => {
    expect(mapJenkinsStatus({ building: false, result: null })).toBe('unknown');
  });
});

describe('jenkinsJobPath', () => {
  it('wraps single segment', () => {
    expect(jenkinsJobPath('my-job')).toBe('job/my-job');
  });
  it('handles folder/job', () => {
    expect(jenkinsJobPath('my-folder/my-job')).toBe('job/my-folder/job/my-job');
  });
});

const baseItem: DeploymentItem = {
  id: 'gh-1',
  connectionId: 'c1',
  provider: 'github_actions',
  connectionLabel: 'my-app',
  runName: 'Deploy to Production',
  buildRef: 'main',
  status: 'success',
  timestamp: '2026-03-19T12:00:00Z',
  url: 'https://github.com/owner/repo/actions/runs/1',
};

describe('getDeployNotificationMessage', () => {
  it('notifies on new item with failure status', () => {
    const result = getDeployNotificationMessage({ ...baseItem, status: 'failure' }, undefined);
    expect(result).toEqual({
      title: 'Deployment failed',
      message: 'Deploy to Production (main) — my-app',
    });
  });

  it('does not notify on new item with success status', () => {
    expect(getDeployNotificationMessage({ ...baseItem, status: 'success' }, undefined)).toBeNull();
  });

  it('does not notify on new item with in_progress status', () => {
    expect(getDeployNotificationMessage({ ...baseItem, status: 'in_progress' }, undefined)).toBeNull();
  });

  it('notifies on in_progress → success', () => {
    const old: DeploySnapshot = { status: 'in_progress', connectionLabel: 'my-app', runName: 'Deploy to Production', buildRef: 'main', url: '' };
    const result = getDeployNotificationMessage({ ...baseItem, status: 'success' }, old);
    expect(result?.title).toBe('Deployment succeeded');
    expect(result?.message).toBe('Deploy to Production (main) — my-app');
  });

  it('notifies on in_progress → failure', () => {
    const old: DeploySnapshot = { status: 'in_progress', connectionLabel: 'my-app', runName: 'Deploy to Production', buildRef: 'main', url: '' };
    const result = getDeployNotificationMessage({ ...baseItem, status: 'failure' }, old);
    expect(result?.title).toBe('Deployment failed');
  });

  it('does not notify on success → success (no change)', () => {
    const old: DeploySnapshot = { status: 'success', connectionLabel: 'my-app', runName: 'Deploy to Production', buildRef: 'main', url: '' };
    expect(getDeployNotificationMessage({ ...baseItem, status: 'success' }, old)).toBeNull();
  });

  it('does not notify on unknown → success (was not in_progress)', () => {
    const old: DeploySnapshot = { status: 'unknown', connectionLabel: 'my-app', runName: 'Deploy to Production', buildRef: 'main', url: '' };
    expect(getDeployNotificationMessage({ ...baseItem, status: 'success' }, old)).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests — confirm they fail**

```bash
cd E:/work/developer-buddy && npm test -- --testPathPattern="tests/shared" 2>&1 | tail -20
```
Expected: FAIL — modules not found

- [ ] **Step 4: Create `src/shared/pr/prNotificationLogic.ts`**

```typescript
export interface PRSnapshot {
  mergeState: string;
  checksFailing: boolean;
}

export function getPRNotificationMessage(
  newMergeState: string,
  newChecksFailing: boolean,
  oldSnapshot: PRSnapshot | undefined,
  prTitle: string,
  repoName: string,
  prNumber: number,
): { title: string; message: string } | null {
  // Never notify on first encounter — caller must have seen this PR before
  if (!oldSnapshot) return null;

  const msg = `${prTitle} — ${repoName} #${prNumber}`;

  if (newMergeState === 'clean' && oldSnapshot.mergeState !== 'clean') {
    return { title: 'Ready to merge', message: msg };
  }
  if (newMergeState === 'unstable' && newChecksFailing && !oldSnapshot.checksFailing) {
    return { title: 'Checks failing', message: msg };
  }
  if (newMergeState === 'dirty' && oldSnapshot.mergeState !== 'dirty') {
    return { title: 'Merge conflict', message: msg };
  }
  if (newMergeState === 'behind' && oldSnapshot.mergeState !== 'behind') {
    return { title: 'Branch behind', message: msg };
  }
  return null;
}
```

- [ ] **Step 5: Run tests — confirm they pass**

```bash
cd E:/work/developer-buddy && npm test -- --testPathPattern="tests/shared" 2>&1 | tail -20
```
Expected: all tests pass

- [ ] **Step 6: Run full test suite**

```bash
cd E:/work/developer-buddy && npm test 2>&1 | tail -10
```
Expected: all suites pass

- [ ] **Step 7: Commit**

```bash
git add src/shared/pr/prNotificationLogic.ts tests/shared/prNotificationLogic.test.ts tests/shared/deploymentFetcher.test.ts
git commit -m "feat(notifications): add PR + deployment notification logic with tests"
```

---

## Chunk 2: Edit deployment connections UI

### Task 3: Add edit-in-place to `DeploymentsPanel.tsx`

**Files:**
- Modify: `src/side-panel/modules/deployments/DeploymentsPanel.tsx`

Three coordinated changes:
1. `AddConnectionForm` — new `existingConnection?` + `initialStep?` props
2. `DeploymentsFeed` — Settings2 + Pencil icons per connection header, `onEditConnection` prop
3. `DeploymentsDashboard` — edit state management, replace-in-place on save

- [ ] **Step 1: Update `AddConnectionForm` — add edit props and pre-population**

Add `Settings2` and `Pencil` to the lucide-react import. Then update `AddConnectionForm`:

```typescript
// Add to lucide-react import
import { ..., Settings2, Pencil } from 'lucide-react';

// Update AddConnectionForm signature
function AddConnectionForm({
  onSave,
  onCancel,
  existingConnection,
  initialStep,
}: {
  onSave: (conn: DeploymentConnection) => void;
  onCancel: () => void;
  existingConnection?: DeploymentConnection;
  initialStep?: 1 | 2;
})
```

Update the state initialisers inside `AddConnectionForm` to pre-populate from `existingConnection`:

```typescript
const [provider, setProvider] = useState<Provider>(
  existingConnection?.type === 'jenkins' ? 'jenkins' : 'github_actions',
);
const [ghRepo, setGhRepo] = useState(
  existingConnection?.type === 'github_actions' ? existingConnection.repo : '',
);
const [jenkinsUrl, setJenkinsUrl] = useState(
  existingConnection?.type === 'jenkins' ? existingConnection.url : '',
);
const [jenkinsUsername, setJenkinsUsername] = useState(
  existingConnection?.type === 'jenkins' ? (existingConnection.username ?? '') : '',
);
const [jenkinsToken, setJenkinsToken] = useState(''); // never pre-fill for security
const [step, setStep] = useState<1 | 2>(initialStep ?? 1);
const [label, setLabel] = useState(existingConnection?.label ?? '');
```

Add a `useEffect` (after all state declarations) to auto-fetch pipelines when starting at step 2:

```typescript
useEffect(() => {
  if ((initialStep ?? 1) === 2 && existingConnection) {
    handleLoadPipelines();
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

In `handleLoadPipelines`, after `setWorkflows(wfs)` (GitHub) or `setJobs(jobList)` (Jenkins), pre-check existing selections:

```typescript
// GitHub Actions — after setWorkflows(wfs):
if (existingConnection?.type === 'github_actions') {
  const existingIds = new Set(existingConnection.selectedWorkflows.map((w) => w.id));
  setSelectedWorkflowIds(existingIds);
}
// Also update label only if not already set by existingConnection
if (!existingConnection) {
  setLabel(ghRepo.trim().split('/')[1] ?? ghRepo.trim());
}

// Jenkins — after setJobs(jobList):
if (existingConnection?.type === 'jenkins') {
  const existingNames = new Set(existingConnection.selectedJobs.map((j) => j.name));
  setSelectedJobNames(existingNames);
}
if (!existingConnection) {
  setLabel('Jenkins');
}
```

Disable the provider selector when editing:

```typescript
// In the JSX, find the provider selector buttons and add disabled={!!existingConnection}:
<button
  key={p}
  onClick={() => !existingConnection && setProvider(p)}
  disabled={!!existingConnection}
  className={`flex-1 py-1.5 text-xs rounded border transition-colors ${
    provider === p
      ? 'bg-accent text-white border-accent'
      : 'bg-surface border-theme-border text-text-primary hover:bg-accent-container disabled:opacity-50 disabled:cursor-not-allowed'
  }`}
>
```

In `handleSave`, preserve the existing `id` when editing:

```typescript
// GitHub Actions — replace:
onSave({
  id: existingConnection?.id ?? crypto.randomUUID(),
  type: 'github_actions',
  label: label.trim(),
  repo: ghRepo.trim(),
  selectedWorkflows: selected,
});
// Jenkins — replace:
onSave({
  id: existingConnection?.id ?? crypto.randomUUID(),
  type: 'jenkins',
  label: label.trim(),
  url: jenkinsUrl.trim(),
  username: jenkinsUsername || undefined,
  token: jenkinsToken || undefined,
  selectedJobs: selected,
});
```

- [ ] **Step 2: Add edit buttons to `DeploymentsFeed`**

Add `onEditConnection` prop to `DeploymentsFeed`:

```typescript
function DeploymentsFeed({
  connections,
  refreshKey,
  onRemoveConnection,
  onEditConnection,
}: {
  connections: DeploymentConnection[];
  refreshKey: number;
  onRemoveConnection: (id: string) => void;
  onEditConnection: (id: string, mode: 'details' | 'pipelines') => void;
})
```

Update the connection group header to include Settings2 and Pencil buttons (all three icons hidden until hover):

```typescript
<div className="flex items-center justify-between px-1 mb-1 group/header">
  <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">
    {label}
  </span>
  <div className="flex items-center gap-0.5 opacity-0 group-hover/header:opacity-100 transition-opacity">
    <button
      onClick={() => onEditConnection(id, 'details')}
      className="p-1 rounded hover:bg-accent-container transition-colors"
      title="Edit connection details"
    >
      <Settings2 size={12} className="text-text-muted" />
    </button>
    <button
      onClick={() => onEditConnection(id, 'pipelines')}
      className="p-1 rounded hover:bg-accent-container transition-colors"
      title="Edit pipelines"
    >
      <Pencil size={12} className="text-text-muted" />
    </button>
    <button
      onClick={() => onRemoveConnection(id)}
      className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
      title="Remove connection"
    >
      <Trash2 size={12} className="text-red-500" />
    </button>
  </div>
</div>
```

- [ ] **Step 3: Update `DeploymentsDashboard` — edit state and replace-in-place**

Add edit state to `DeploymentsDashboard`:

```typescript
const [editingConn, setEditingConn] = useState<{
  conn: DeploymentConnection;
  mode: 'details' | 'pipelines';
} | null>(null);
```

Update `handleSaveConnection` to replace in-place when editing:

```typescript
const handleSaveConnection = async (conn: DeploymentConnection) => {
  if (!config) return;
  const isEdit = config.connections.some((c) => c.id === conn.id);
  const updatedConnections = isEdit
    ? config.connections.map((c) => (c.id === conn.id ? conn : c))
    : [...config.connections, conn];
  const next: DeploymentsConfig = { connections: updatedConnections };
  await saveDeploymentsConfig(next);
  setConfig(next);
  setShowForm(false);
  setEditingConn(null);
  setRefreshKey((k) => k + 1);
};
```

Add a cancel handler for edit mode:
```typescript
const handleEditCancel = () => setEditingConn(null);
```

Update the render section to show the edit form when `editingConn` is set:

```typescript
{showForm || editingConn ? (
  <AddConnectionForm
    onSave={handleSaveConnection}
    onCancel={editingConn ? handleEditCancel : () => setShowForm(false)}
    existingConnection={editingConn?.conn}
    initialStep={editingConn?.mode === 'details' ? 1 : 2}
  />
) : (
  <DeploymentsFeed
    connections={config.connections}
    refreshKey={refreshKey}
    onRemoveConnection={handleRemoveConnection}
    onEditConnection={(id, mode) => {
      const conn = config.connections.find((c) => c.id === id);
      if (conn) setEditingConn({ conn, mode });
    }}
  />
)}
```

Also hide the header action buttons (refresh, add) when in edit mode — update the `!showForm` guard:

```typescript
{!showForm && !editingConn && (
  <div className="flex items-center gap-2">
    ...
  </div>
)}
```

- [ ] **Step 4: Verify build passes**

```bash
cd E:/work/developer-buddy && npm run build 2>&1 | tail -5
```
Expected: `compiled successfully`

- [ ] **Step 5: Commit**

```bash
git add src/side-panel/modules/deployments/DeploymentsPanel.tsx
git commit -m "feat(deployments): add edit connection details and edit pipelines"
```

---

## Chunk 3: Background service worker + manifest

### Task 4: Add `alarms` permission and `buddy-notify` alarm

**Files:**
- Modify: `manifest.json`
- Modify: `src/background/service-worker.ts`

- [ ] **Step 1: Add `"alarms"` to `manifest.json`**

In `manifest.json`, add `"alarms"` to the `permissions` array:

```json
"permissions": [
  "storage",
  "tabs",
  "scripting",
  "sidePanel",
  "offscreen",
  "notifications",
  "clipboardWrite",
  "alarms"
],
```

- [ ] **Step 2: Add notification imports to `service-worker.ts`**

Add the import at the top of `src/background/service-worker.ts`:

```typescript
import {
  fetchAllConnections,
  getDeployNotificationMessage,
  type DeploymentConnection,
  type DeploymentsConfig,
  type DeploySnapshot,
} from '../shared/deployments/deploymentFetcher';
import { getPRNotificationMessage, type PRSnapshot } from '../shared/pr/prNotificationLogic';
```

- [ ] **Step 3: Add alarm creation in `onInstalled`**

Inside the existing `chrome.runtime.onInstalled.addListener` callback, append after `syncUserScriptRegistrations()`:

```typescript
// Create the buddy-notify alarm (clears any legacy 'pr-notify' from prior versions)
chrome.alarms.clear('pr-notify');
chrome.alarms.get('buddy-notify', (existing) => {
  if (!existing) chrome.alarms.create('buddy-notify', { periodInMinutes: 2 });
});
```

- [ ] **Step 4: Add notification click handler**

After the `handleNotification` function, add:

```typescript
chrome.notifications.onClicked.addListener((notificationId) => {
  const url = notificationId.slice(notificationId.indexOf(':') + 1);
  if (url.startsWith('http')) {
    chrome.tabs.create({ url });
  }
  chrome.notifications.clear(notificationId);
});
```

- [ ] **Step 5: Verify build passes**

```bash
cd E:/work/developer-buddy && npm run build 2>&1 | tail -5
```

- [ ] **Step 6: Commit**

```bash
git add manifest.json src/background/service-worker.ts
git commit -m "feat(notifications): add alarms permission, buddy-notify alarm, notification click handler"
```

---

### Task 5: Add `runPRNotifyPoll` to service worker

**Files:**
- Modify: `src/background/service-worker.ts`

- [ ] **Step 1: Add storage type declarations (inline — no shared import needed)**

At the top of `service-worker.ts` (after existing imports), add local interface for storage shapes used in the poll:

```typescript
interface PRNotificationState {
  snapshots: Record<string, PRSnapshot>;
}
```

- [ ] **Step 2: Add `runPRNotifyPoll` function**

Add after the `handleNotification` function:

```typescript
async function runPRNotifyPoll(): Promise<void> {
  try {
    // 1. Check GitHub config
    const ghResult = await chrome.storage.local.get('developer_buddy_github');
    const ghConfig = ghResult['developer_buddy_github'] as
      | { token?: string; username?: string }
      | undefined;
    if (!ghConfig?.token || !ghConfig?.username) return;

    // 2. Check notifications enabled
    const notifResult = await chrome.storage.local.get('developer_buddy_pr_notifications');
    const notifSettings = notifResult['developer_buddy_pr_notifications'] as
      | { enabled?: boolean }
      | undefined;
    if (notifSettings?.enabled === false) return;

    // 3. Fetch authored open PRs
    const searchUrl = `https://api.github.com/search/issues?q=${encodeURIComponent(
      `is:pr is:open author:${ghConfig.username}`,
    )}&sort=updated&per_page=20`;
    const searchRes = await fetch(searchUrl, {
      headers: {
        Authorization: `token ${ghConfig.token}`,
        Accept: 'application/vnd.github+json',
      },
    });
    if (!searchRes.ok) return;
    const searchData = await searchRes.json();
    const prs = (
      searchData.items as Array<{
        id: number;
        number: number;
        title: string;
        html_url: string;
        repository_url: string;
        pull_request?: { url: string };
      }>
    ).filter((item) => !!item.pull_request);

    // 4. Load current snapshot
    const stateResult = await chrome.storage.local.get('developer_buddy_pr_notify_state');
    const state = stateResult['developer_buddy_pr_notify_state'] as
      | PRNotificationState
      | undefined;
    const oldSnapshots: Record<string, PRSnapshot> = state?.snapshots ?? {};
    const newSnapshots: Record<string, PRSnapshot> = {};

    // 5. For each PR, fetch detail + check-runs, compare, notify
    for (const pr of prs) {
      if (!pr.pull_request?.url) continue;
      const repoName = pr.repository_url.replace('https://api.github.com/repos/', '');
      const prKey = `${repoName}#${pr.number}`;

      try {
        const detailRes = await fetch(pr.pull_request.url, {
          headers: {
            Authorization: `token ${ghConfig.token}`,
            Accept: 'application/vnd.github+json',
          },
        });
        if (!detailRes.ok) {
          if (oldSnapshots[prKey]) newSnapshots[prKey] = oldSnapshots[prKey];
          continue;
        }
        const detail = await detailRes.json() as {
          draft: boolean;
          mergeable_state: string;
          head: { sha: string };
        };
        // Skip draft PRs (draft field is only reliable on the detail response)
        if (detail.draft) continue;
        const mergeState = detail.mergeable_state;

        let checksFailing = false;
        if (mergeState === 'unstable') {
          const checksRes = await fetch(
            `${pr.repository_url}/commits/${detail.head.sha}/check-runs?per_page=100`,
            {
              headers: {
                Authorization: `token ${ghConfig.token}`,
                Accept: 'application/vnd.github+json',
              },
            },
          );
          if (checksRes.ok) {
            const checksData = await checksRes.json();
            const runs = (checksData.check_runs ?? []) as Array<{ status: string }>;
            checksFailing = !runs.some(
              (r) => r.status === 'in_progress' || r.status === 'queued',
            );
          }
        }

        // Only fire if we've seen this PR before (avoids notification flood on first run)
        if (prKey in oldSnapshots) {
          const notification = getPRNotificationMessage(
            mergeState,
            checksFailing,
            oldSnapshots[prKey],
            pr.title,
            repoName,
            pr.number,
          );
          if (notification) {
            chrome.notifications.create(`pr-notify:${pr.html_url}`, {
              type: 'basic',
              iconUrl: chrome.runtime.getURL('icons/icon48.png'),
              title: notification.title,
              message: notification.message,
            });
          }
        }

        newSnapshots[prKey] = { mergeState, checksFailing };
      } catch {
        // Preserve last-known-good snapshot on per-PR error
        if (oldSnapshots[prKey]) newSnapshots[prKey] = oldSnapshots[prKey];
      }
    }

    // 6. Save pruned snapshot (only currently open PRs)
    await chrome.storage.local.set({
      developer_buddy_pr_notify_state: { snapshots: newSnapshots },
    });
  } catch {
    // Fail silently — next alarm will retry
  }
}
```

- [ ] **Step 3: Add alarm listener**

Add the alarm listener after the `chrome.runtime.onMessage.addListener` block:

```typescript
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'buddy-notify') {
    runPRNotifyPoll().catch(console.error);
    runDeployNotifyPoll().catch(console.error);
  }
});
```

Note: `runDeployNotifyPoll` is added in Task 6 — add a forward stub or add both together. If adding together, skip this step and add the full listener in Task 6 instead.

- [ ] **Step 4: Verify build passes**

```bash
cd E:/work/developer-buddy && npm run build 2>&1 | tail -5
```
Expected: `compiled successfully`

- [ ] **Step 5: Commit**

```bash
git add src/background/service-worker.ts
git commit -m "feat(notifications): add PR notification poll cycle to service worker"
```

---

### Task 6: Add `runDeployNotifyPoll` to service worker

**Files:**
- Modify: `src/background/service-worker.ts`

- [ ] **Step 1: Add `DeployNotificationState` type**

After the `PRNotificationState` interface, add:

```typescript
interface DeployNotificationState {
  snapshots: Record<string, DeploySnapshot>;
}
```

(`DeploymentsConfig` is already imported from the shared module — do not re-declare it.)

- [ ] **Step 2: Add `runDeployNotifyPoll` function**

Add after `runPRNotifyPoll`:

```typescript
async function runDeployNotifyPoll(): Promise<void> {
  try {
    // 1. Check deployments config
    const deplResult = await chrome.storage.local.get('developer_buddy_deployments');
    const deplConfig = deplResult['developer_buddy_deployments'] as
      | DeploymentsConfig
      | undefined;
    if (!deplConfig?.connections?.length) return;

    // 2. Check notifications enabled
    const notifResult = await chrome.storage.local.get('developer_buddy_deploy_notifications');
    const notifSettings = notifResult['developer_buddy_deploy_notifications'] as
      | { enabled?: boolean }
      | undefined;
    if (notifSettings?.enabled === false) return;

    // 3. Load GitHub token (may be null — fetchAllConnections handles this gracefully)
    const ghResult = await chrome.storage.local.get('developer_buddy_github');
    const ghToken =
      (ghResult['developer_buddy_github'] as { token?: string } | undefined)?.token ?? null;

    // 4. Fetch all deployment items
    const { items } = await fetchAllConnections(deplConfig.connections, ghToken);

    // 5. Load current snapshot
    const stateResult = await chrome.storage.local.get('developer_buddy_deploy_notify_state');
    const state = stateResult['developer_buddy_deploy_notify_state'] as
      | DeployNotificationState
      | undefined;
    const oldSnapshots: Record<string, DeploySnapshot> = state?.snapshots ?? {};
    const newSnapshots: Record<string, DeploySnapshot> = {};

    // 6. Compare and fire notifications
    for (const item of items) {
      const notification = getDeployNotificationMessage(item, oldSnapshots[item.id]);
      if (notification) {
        chrome.notifications.create(`deploy-notify:${item.url}`, {
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon48.png'),
          title: notification.title,
          message: notification.message,
        });
      }
      newSnapshots[item.id] = {
        status: item.status,
        connectionLabel: item.connectionLabel,
        runName: item.runName,
        buildRef: item.buildRef,
        url: item.url,
      };
    }

    // 7. Save pruned snapshot
    await chrome.storage.local.set({
      developer_buddy_deploy_notify_state: { snapshots: newSnapshots },
    });
  } catch {
    // Fail silently
  }
}
```

- [ ] **Step 3: Ensure the alarm listener calls both polls**

If the alarm listener was added in Task 5, verify it calls both:
```typescript
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'buddy-notify') {
    runPRNotifyPoll().catch(console.error);
    runDeployNotifyPoll().catch(console.error);
  }
});
```

- [ ] **Step 4: Verify build passes**

```bash
cd E:/work/developer-buddy && npm run build 2>&1 | tail -5
```

- [ ] **Step 5: Verify all tests pass**

```bash
cd E:/work/developer-buddy && npm test 2>&1 | tail -10
```
Expected: all suites pass

- [ ] **Step 6: Commit**

```bash
git add src/background/service-worker.ts
git commit -m "feat(notifications): add deployment notification poll cycle to service worker"
```

---

## Chunk 4: Notification toggles UI

### Task 7: Add PR notification toggle to `SelfService.tsx`

**Files:**
- Modify: `src/side-panel/modules/self-service/SelfService.tsx`

The toggle lives inside `PRDashboard`, above the tab bar (between the header row and the tabs row).

- [ ] **Step 1: Add `Bell` / `BellOff` to lucide-react import**

```typescript
import { ..., Bell, BellOff } from 'lucide-react';
```

- [ ] **Step 2: Add notification state to `PRDashboard`**

Inside `PRDashboard`, add after existing state declarations:

```typescript
const [notificationsEnabled, setNotificationsEnabled] = useState(true);

// Load notification setting on mount
useEffect(() => {
  chrome.storage.local.get('developer_buddy_pr_notifications').then((result) => {
    const cfg = result['developer_buddy_pr_notifications'] as { enabled?: boolean } | undefined;
    // Default to true if key absent
    setNotificationsEnabled(cfg?.enabled !== false);
  });
}, []);

const toggleNotifications = () => {
  const next = !notificationsEnabled;
  setNotificationsEnabled(next);
  chrome.storage.local.set({ developer_buddy_pr_notifications: { enabled: next } });
};
```

- [ ] **Step 3: Add toggle row JSX between header and tabs**

In `PRDashboard`'s render, locate the `{/* Tabs */}` comment block (line 474). Insert the toggle row immediately before it (after the closing `</div>` of the header block):

```tsx
{/* Notification toggle */}
<div className="flex items-center gap-2 px-3 py-1.5 border-b border-theme-border bg-surface">
  <button
    onClick={toggleNotifications}
    className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors ml-auto"
    title={notificationsEnabled ? 'Disable PR notifications' : 'Enable PR notifications'}
  >
    {notificationsEnabled ? (
      <Bell size={11} className="text-accent" />
    ) : (
      <BellOff size={11} />
    )}
    <span>Notifications {notificationsEnabled ? 'on' : 'off'}</span>
    {/* Pill toggle */}
    <span
      className={`inline-flex w-7 h-4 rounded-full transition-colors ${
        notificationsEnabled ? 'bg-accent' : 'bg-gray-300 dark:bg-gray-600'
      }`}
    >
      <span
        className={`m-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${
          notificationsEnabled ? 'translate-x-3' : 'translate-x-0'
        }`}
      />
    </span>
  </button>
</div>
```

- [ ] **Step 4: Verify build passes**

```bash
cd E:/work/developer-buddy && npm run build 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add src/side-panel/modules/self-service/SelfService.tsx
git commit -m "feat(notifications): add PR notification opt-out toggle to Pull Requests panel"
```

---

### Task 8: Add deployment notification toggle to `DeploymentsPanel.tsx`

**Files:**
- Modify: `src/side-panel/modules/deployments/DeploymentsPanel.tsx`

The toggle lives in `DeploymentsDashboard`, between the header row and the feed (hidden when the add/edit form is open).

- [ ] **Step 1: Add `Bell` / `BellOff` to lucide-react import in `DeploymentsPanel.tsx`**

```typescript
import { ..., Bell, BellOff } from 'lucide-react';
```

- [ ] **Step 2: Add notification state to `DeploymentsDashboard`**

Inside `DeploymentsDashboard`, add after existing state declarations:

```typescript
const [notificationsEnabled, setNotificationsEnabled] = useState(true);

useEffect(() => {
  chrome.storage.local.get('developer_buddy_deploy_notifications').then((result) => {
    const cfg = result['developer_buddy_deploy_notifications'] as
      | { enabled?: boolean }
      | undefined;
    setNotificationsEnabled(cfg?.enabled !== false);
  });
}, []);

const toggleNotifications = () => {
  const next = !notificationsEnabled;
  setNotificationsEnabled(next);
  chrome.storage.local.set({ developer_buddy_deploy_notifications: { enabled: next } });
};
```

- [ ] **Step 3: Add toggle row JSX**

In `DeploymentsDashboard`'s render, inside the `{!showForm && !editingConn && (...)}` block, after the header row `<div>` and before `<DeploymentsFeed>`, add:

```tsx
{/* Notification toggle */}
<div className="flex items-center justify-end">
  <button
    onClick={toggleNotifications}
    className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors"
    title={notificationsEnabled ? 'Disable deployment notifications' : 'Enable deployment notifications'}
  >
    {notificationsEnabled ? (
      <Bell size={11} className="text-accent" />
    ) : (
      <BellOff size={11} />
    )}
    <span>Notifications {notificationsEnabled ? 'on' : 'off'}</span>
    <span
      className={`inline-flex w-7 h-4 rounded-full transition-colors ${
        notificationsEnabled ? 'bg-accent' : 'bg-gray-300 dark:bg-gray-600'
      }`}
    >
      <span
        className={`m-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${
          notificationsEnabled ? 'translate-x-3' : 'translate-x-0'
        }`}
      />
    </span>
  </button>
</div>
```

- [ ] **Step 4: Verify full build passes**

```bash
cd E:/work/developer-buddy && npm run build 2>&1 | tail -5
```
Expected: `compiled successfully`

- [ ] **Step 5: Run full test suite**

```bash
cd E:/work/developer-buddy && npm test 2>&1 | tail -10
```
Expected: all suites pass, 0 failures

- [ ] **Step 6: Commit**

```bash
git add src/side-panel/modules/deployments/DeploymentsPanel.tsx
git commit -m "feat(notifications): add deployment notification opt-out toggle to Deployments panel"
```

---

## Verification Checklist

After all tasks complete:

- [ ] `npm run build` — zero errors
- [ ] `npm test` — all 52+ tests pass
- [ ] Load `dist/` as unpacked extension
- [ ] Deployments panel: hover a connection header → Settings2, Pencil, Trash2 appear
- [ ] Click Settings2 → form opens pre-filled at Step 1, provider selector disabled
- [ ] Click Pencil → spinner shows, then Step 2 with existing selections pre-checked; Save updates in-place
- [ ] Pull Requests panel: notification toggle row appears above "Authored/Review/Merged" tabs
- [ ] Toggle off → writes `enabled: false` to storage; toggle on → writes `enabled: true`
- [ ] Deployments panel: notification toggle row appears between header and feed
- [ ] Background alarm: open `chrome://extensions` → service worker → check `chrome.alarms.getAll()` returns `[{name: 'buddy-notify', ...}]`
- [ ] Clicking a notification opens the PR/deployment URL in a new tab
