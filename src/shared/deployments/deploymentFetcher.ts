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
      id: `gh-${connectionId}-${run.id}`,
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
