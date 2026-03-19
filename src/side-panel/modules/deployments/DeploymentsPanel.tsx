import React, { useState, useEffect, useCallback } from 'react';
import {
  Rocket,
  RefreshCw,
  Plus,
  ExternalLink,
  Trash2,
  Loader2,
  AlertCircle,
  ChevronLeft,
} from 'lucide-react';
import {
  type GitHubActionsConnection,
  type JenkinsConnection,
  type DeploymentConnection,
  type DeploymentsConfig,
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

async function fetchDeploymentsConfig(): Promise<DeploymentsConfig> {
  return new Promise((resolve) => {
    chrome.storage.local.get('developer_buddy_deployments', (result) => {
      const cfg = result['developer_buddy_deployments'] as DeploymentsConfig | undefined;
      resolve(cfg ?? { connections: [] });
    });
  });
}

async function saveDeploymentsConfig(config: DeploymentsConfig): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ developer_buddy_deployments: config }, resolve);
  });
}

async function fetchGitHubToken(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get('developer_buddy_github', (result) => {
      const cfg = result['developer_buddy_github'] as { token?: string } | undefined;
      resolve(cfg?.token ?? null);
    });
  });
}

// ---------------------------------------------------------------------------
// GitHub Actions API (panel-only: workflow listing for AddConnectionForm)
// ---------------------------------------------------------------------------

async function fetchGitHubWorkflows(
  repo: string,
  token: string,
): Promise<Array<{ id: number; name: string; path: string; state: string }>> {
  const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows`, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? `GitHub API error: ${res.status}`);
  }
  const data = await res.json();
  return data.workflows ?? [];
}

// ---------------------------------------------------------------------------
// Jenkins API (panel-only: job listing for AddConnectionForm)
// ---------------------------------------------------------------------------

async function fetchJenkinsJobs(
  url: string,
  username?: string,
  token?: string,
): Promise<Array<{ name: string; displayName: string; color?: string }>> {
  const apiUrl = `${url.replace(/\/$/, '')}/api/json?tree=jobs[name,url,displayName,color]`;
  const res = await fetch(apiUrl, { headers: jenkinsAuthHeaders(username, token) });
  if (!res.ok) throw new Error(`Jenkins API error: ${res.status}`);
  const data = await res.json();
  return data.jobs ?? [];
}

// ---------------------------------------------------------------------------
// StatusDot
// ---------------------------------------------------------------------------

function StatusDot({ status }: { status: DeploymentItem['status'] }) {
  if (status === 'in_progress') {
    return <Loader2 size={12} className="text-yellow-500 animate-spin shrink-0" />;
  }
  const colors: Record<string, string> = {
    success: 'bg-green-500',
    failure: 'bg-red-500',
    cancelled: 'bg-gray-400',
    unknown: 'bg-gray-300',
  };
  return <span className={`w-2 h-2 rounded-full shrink-0 ${colors[status] ?? 'bg-gray-300'}`} />;
}

// ---------------------------------------------------------------------------
// DeploymentRow
// ---------------------------------------------------------------------------

function DeploymentRow({ item }: { item: DeploymentItem }) {
  return (
    <button
      onClick={() => window.open(item.url, '_blank')}
      className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent-container transition-colors group"
    >
      <StatusDot status={item.status} />
      <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-accent/15 text-accent shrink-0 max-w-[80px] truncate">
        {item.connectionLabel}
      </span>
      <span className="flex-1 min-w-0">
        <span className="text-xs font-medium text-text-primary truncate block">{item.runName}</span>
      </span>
      <span className="text-xs text-text-muted shrink-0">{item.buildRef}</span>
      <span className="text-xs text-text-muted shrink-0 hidden sm:inline">
        {relativeTime(item.timestamp)}
      </span>
      <ExternalLink
        size={12}
        className="text-text-muted shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// DeploymentsFeed
// ---------------------------------------------------------------------------

function DeploymentsFeed({
  connections,
  refreshKey,
  onRemoveConnection,
}: {
  connections: DeploymentConnection[];
  refreshKey: number;
  onRemoveConnection: (id: string) => void;
}) {
  const [items, setItems] = useState<DeploymentItem[]>([]);
  const [errors, setErrors] = useState<ConnectionError[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const githubToken = await fetchGitHubToken();
    const result = await fetchAllConnections(connections, githubToken);
    setItems(result.items);
    setErrors(result.errors);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connections, refreshKey]);

  useEffect(() => {
    if (connections.length === 0) {
      setLoading(false);
      setItems([]);
      setErrors([]);
      return;
    }
    load();
  }, [load, connections.length]);

  if (connections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <Rocket size={32} className="text-text-muted" />
        <div>
          <p className="text-sm font-medium text-text-primary">No connections yet</p>
          <p className="text-xs text-text-muted mt-1">
            Click "+" to add a GitHub Actions or Jenkins connection
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="text-accent animate-spin" />
      </div>
    );
  }

  // Group items by connectionId
  const grouped = new Map<string, DeploymentItem[]>();
  for (const item of items) {
    const group = grouped.get(item.connectionId) ?? [];
    group.push(item);
    grouped.set(item.connectionId, group);
  }

  // Ordered list of connection sections (items first, then error-only connections)
  const seen = new Set<string>();
  const connectionOrder: Array<{ id: string; label: string }> = [];
  for (const item of items) {
    if (!seen.has(item.connectionId)) {
      seen.add(item.connectionId);
      connectionOrder.push({ id: item.connectionId, label: item.connectionLabel });
    }
  }
  for (const err of errors) {
    if (!seen.has(err.connectionId)) {
      seen.add(err.connectionId);
      connectionOrder.push({ id: err.connectionId, label: err.connectionLabel });
    }
  }

  return (
    <div className="space-y-3">
      {errors.map((err) => (
        <div
          key={err.connectionId}
          className="flex items-start gap-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
        >
          <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <span className="text-xs font-medium text-red-700 dark:text-red-400">
              {err.connectionLabel}:{' '}
            </span>
            <span className="text-xs text-red-600 dark:text-red-300">{err.message}</span>
          </div>
        </div>
      ))}

      {connectionOrder.map(({ id, label }) => {
        const connItems = grouped.get(id) ?? [];
        return (
          <div key={id} className="space-y-0.5">
            <div className="flex items-center justify-between px-1 mb-1 group/header">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">
                {label}
              </span>
              <button
                onClick={() => onRemoveConnection(id)}
                className="opacity-0 group-hover/header:opacity-100 transition-opacity p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30"
                title="Remove connection"
              >
                <Trash2 size={12} className="text-red-500" />
              </button>
            </div>
            {connItems.length === 0 ? (
              <p className="text-xs text-text-muted px-3 py-1">No recent deployments</p>
            ) : (
              connItems.map((item) => <DeploymentRow key={item.id} item={item} />)
            )}
          </div>
        );
      })}

      {items.length === 0 && errors.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
          <Rocket size={24} className="text-text-muted" />
          <p className="text-xs text-text-muted">No recent deployments</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AddConnectionForm
// ---------------------------------------------------------------------------

type Provider = 'github_actions' | 'jenkins';

interface WorkflowOption {
  id: number;
  name: string;
  path: string;
  state: string;
}

interface JobOption {
  name: string;
  displayName: string;
  color?: string;
}

function AddConnectionForm({
  onSave,
  onCancel,
}: {
  onSave: (conn: DeploymentConnection) => void;
  onCancel: () => void;
}) {
  const [provider, setProvider] = useState<Provider>('github_actions');
  const [ghRepo, setGhRepo] = useState('');
  const [jenkinsUrl, setJenkinsUrl] = useState('');
  const [jenkinsUsername, setJenkinsUsername] = useState('');
  const [jenkinsToken, setJenkinsToken] = useState('');
  const [step1Error, setStep1Error] = useState('');
  const [loadingPipelines, setLoadingPipelines] = useState(false);

  const [step, setStep] = useState<1 | 2>(1);
  const [workflows, setWorkflows] = useState<WorkflowOption[]>([]);
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [selectedWorkflowIds, setSelectedWorkflowIds] = useState<Set<number>>(new Set());
  const [selectedJobNames, setSelectedJobNames] = useState<Set<string>>(new Set());
  const [label, setLabel] = useState('');
  const [saveError, setSaveError] = useState('');

  const handleLoadPipelines = async () => {
    setStep1Error('');
    if (provider === 'github_actions') {
      if (!/^[^/]+\/[^/]+$/.test(ghRepo.trim())) {
        setStep1Error('Repo must be in "owner/repo" format');
        return;
      }
      const token = await fetchGitHubToken();
      if (!token) {
        setStep1Error('GitHub not configured — connect in the Pull Requests tab.');
        return;
      }
      setLoadingPipelines(true);
      try {
        const wfs = await fetchGitHubWorkflows(ghRepo.trim(), token);
        setWorkflows(wfs);
        setLabel(ghRepo.trim().split('/')[1] ?? ghRepo.trim());
        setStep(2);
      } catch (e: unknown) {
        setStep1Error((e as Error).message ?? 'Failed to load workflows');
      } finally {
        setLoadingPipelines(false);
      }
    } else {
      if (!jenkinsUrl.trim().startsWith('http')) {
        setStep1Error('Jenkins URL must start with http:// or https://');
        return;
      }
      setLoadingPipelines(true);
      try {
        const jobList = await fetchJenkinsJobs(
          jenkinsUrl.trim(),
          jenkinsUsername || undefined,
          jenkinsToken || undefined,
        );
        setJobs(jobList);
        setLabel('Jenkins');
        setStep(2);
      } catch (e: unknown) {
        setStep1Error((e as Error).message ?? 'Failed to load Jenkins jobs');
      } finally {
        setLoadingPipelines(false);
      }
    }
  };

  const handleSave = () => {
    setSaveError('');
    if (!label.trim()) {
      setSaveError('Label is required');
      return;
    }
    if (provider === 'github_actions') {
      if (selectedWorkflowIds.size === 0) {
        setSaveError('Select at least one workflow');
        return;
      }
      const selected = workflows
        .filter((wf) => selectedWorkflowIds.has(wf.id))
        .map((wf) => ({ id: wf.id, name: wf.name, path: wf.path }));
      onSave({
        id: crypto.randomUUID(),
        type: 'github_actions',
        label: label.trim(),
        repo: ghRepo.trim(),
        selectedWorkflows: selected,
      });
    } else {
      if (selectedJobNames.size === 0) {
        setSaveError('Select at least one job');
        return;
      }
      const selected = jobs
        .filter((j) => selectedJobNames.has(j.name))
        .map((j) => ({ name: j.name, displayName: j.displayName || j.name }));
      onSave({
        id: crypto.randomUUID(),
        type: 'jenkins',
        label: label.trim(),
        url: jenkinsUrl.trim(),
        username: jenkinsUsername || undefined,
        token: jenkinsToken || undefined,
        selectedJobs: selected,
      });
    }
  };

  const inputClass =
    'w-full px-2.5 py-1.5 text-xs rounded border border-theme-border bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-accent';
  const labelClass = 'block text-xs font-medium text-text-secondary mb-1';

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-text-primary">Add Connection</h3>

      {step === 1 && (
        <>
          <div>
            <label className={labelClass}>Provider</label>
            <div className="flex gap-2">
              {(['github_actions', 'jenkins'] as Provider[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setProvider(p)}
                  className={`flex-1 py-1.5 text-xs rounded border transition-colors ${
                    provider === p
                      ? 'bg-accent text-white border-accent'
                      : 'bg-surface border-theme-border text-text-primary hover:bg-accent-container'
                  }`}
                >
                  {p === 'github_actions' ? 'GitHub Actions' : 'Jenkins'}
                </button>
              ))}
            </div>
          </div>

          {provider === 'github_actions' ? (
            <div>
              <label className={labelClass}>Repository</label>
              <input
                type="text"
                value={ghRepo}
                onChange={(e) => setGhRepo(e.target.value)}
                placeholder="owner/repo"
                className={inputClass}
              />
            </div>
          ) : (
            <>
              <div>
                <label className={labelClass}>Jenkins URL</label>
                <input
                  type="text"
                  value={jenkinsUrl}
                  onChange={(e) => setJenkinsUrl(e.target.value)}
                  placeholder="https://jenkins.example.com"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Username (optional)</label>
                <input
                  type="text"
                  value={jenkinsUsername}
                  onChange={(e) => setJenkinsUsername(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>API Token (optional)</label>
                <input
                  type="password"
                  value={jenkinsToken}
                  onChange={(e) => setJenkinsToken(e.target.value)}
                  className={inputClass}
                />
              </div>
            </>
          )}

          {step1Error && (
            <div className="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400">
              <AlertCircle size={12} className="shrink-0 mt-0.5" />
              <span>{step1Error}</span>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={onCancel}
              className="flex-1 py-1.5 text-xs rounded border border-theme-border text-text-primary hover:bg-accent-container transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleLoadPipelines}
              disabled={loadingPipelines}
              className="flex-1 py-1.5 text-xs rounded bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
            >
              {loadingPipelines && <Loader2 size={12} className="animate-spin" />}
              Load Pipelines →
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div>
            <label className={labelClass}>Label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>
              {provider === 'github_actions' ? 'Select Workflows' : 'Select Jobs'}
            </label>
            <div className="space-y-1.5 max-h-48 overflow-auto border border-theme-border rounded p-2">
              {provider === 'github_actions'
                ? workflows.map((wf) => (
                    <label key={wf.id} className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedWorkflowIds.has(wf.id)}
                        onChange={(e) => {
                          const next = new Set(selectedWorkflowIds);
                          if (e.target.checked) next.add(wf.id);
                          else next.delete(wf.id);
                          setSelectedWorkflowIds(next);
                        }}
                        className="mt-0.5 accent-accent"
                      />
                      <div>
                        <div className="text-xs font-medium text-text-primary">{wf.name}</div>
                        <div className="text-xs text-text-muted">{wf.path}</div>
                      </div>
                    </label>
                  ))
                : jobs.map((job) => (
                    <label key={job.name} className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedJobNames.has(job.name)}
                        onChange={(e) => {
                          const next = new Set(selectedJobNames);
                          if (e.target.checked) next.add(job.name);
                          else next.delete(job.name);
                          setSelectedJobNames(next);
                        }}
                        className="mt-0.5 accent-accent"
                      />
                      <div>
                        <div className="text-xs font-medium text-text-primary">
                          {job.displayName || job.name}
                        </div>
                        <div className="text-xs text-text-muted">{job.name}</div>
                      </div>
                    </label>
                  ))}
              {provider === 'github_actions' && workflows.length === 0 && (
                <p className="text-xs text-text-muted py-2">No workflows found</p>
              )}
              {provider === 'jenkins' && jobs.length === 0 && (
                <p className="text-xs text-text-muted py-2">No jobs found</p>
              )}
            </div>
          </div>

          {saveError && (
            <div className="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400">
              <AlertCircle size={12} className="shrink-0 mt-0.5" />
              <span>{saveError}</span>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setStep(1)}
              className="flex-1 py-1.5 text-xs rounded border border-theme-border text-text-primary hover:bg-accent-container transition-colors flex items-center justify-center gap-1"
            >
              <ChevronLeft size={12} />
              Back
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-1.5 text-xs rounded bg-accent text-white hover:bg-accent/90 transition-colors"
            >
              Save
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DeploymentsDashboard
// ---------------------------------------------------------------------------

function DeploymentsDashboard() {
  const [config, setConfig] = useState<DeploymentsConfig | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetchDeploymentsConfig().then(setConfig);
  }, []);

  const handleSaveConnection = async (conn: DeploymentConnection) => {
    if (!config) return;
    const next: DeploymentsConfig = { connections: [...config.connections, conn] };
    await saveDeploymentsConfig(next);
    setConfig(next);
    setShowForm(false);
    setRefreshKey((k) => k + 1);
  };

  const handleRemoveConnection = async (id: string) => {
    if (!config) return;
    const next: DeploymentsConfig = {
      connections: config.connections.filter((c) => c.id !== id),
    };
    await saveDeploymentsConfig(next);
    setConfig(next);
    setRefreshKey((k) => k + 1);
  };

  if (!config) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="text-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!showForm && (
        <div className="flex items-center gap-2">
          <Rocket size={16} className="text-accent shrink-0" />
          <span className="text-sm font-semibold text-text-primary flex-1">Deployments</span>
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="p-1 rounded hover:bg-accent-container transition-colors"
            title="Refresh"
          >
            <RefreshCw size={14} className="text-text-muted" />
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="p-1 rounded hover:bg-accent-container transition-colors"
            title="Add connection"
          >
            <Plus size={14} className="text-text-muted" />
          </button>
        </div>
      )}

      {showForm ? (
        <AddConnectionForm onSave={handleSaveConnection} onCancel={() => setShowForm(false)} />
      ) : (
        <DeploymentsFeed
          connections={config.connections}
          refreshKey={refreshKey}
          onRemoveConnection={handleRemoveConnection}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DeploymentsPanel (root export)
// ---------------------------------------------------------------------------

export function DeploymentsPanel() {
  return <DeploymentsDashboard />;
}
