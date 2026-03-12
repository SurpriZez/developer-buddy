import React, { useState, useEffect, useCallback } from 'react';
import {
  GitPullRequest,
  RefreshCw,
  ExternalLink,
  LogOut,
  AlertCircle,
  Loader2,
  Eye,
  MessageSquare,
  Clock,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GitHubConfig {
  token: string;
  username: string;
}

interface GitHubPR {
  id: number;
  number: number;
  title: string;
  html_url: string;
  repository_url: string;
  draft: boolean;
  comments: number;
  created_at: string;
  pull_request?: { url: string };
}

type Tab = 'authored' | 'review';

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

function repoName(repositoryUrl: string): string {
  return repositoryUrl.replace('https://api.github.com/repos/', '');
}

async function fetchGitHubConfig(): Promise<GitHubConfig | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get('developer_buddy_github', (result) => {
      const cfg = result['developer_buddy_github'] as GitHubConfig | undefined;
      if (cfg && cfg.token && cfg.username) {
        resolve(cfg);
      } else {
        resolve(null);
      }
    });
  });
}

async function saveGitHubConfig(config: GitHubConfig): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ developer_buddy_github: config }, resolve);
  });
}

async function clearGitHubConfig(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.remove('developer_buddy_github', resolve);
  });
}

async function searchPRs(token: string, query: string): Promise<GitHubPR[]> {
  const url = `https://api.github.com/search/issues?q=${encodeURIComponent(query)}&sort=updated&per_page=20`;
  const res = await fetch(url, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `GitHub API error ${res.status}`);
  }
  const data = await res.json();
  // Filter to actual PRs (search/issues can return issues too)
  return (data.items as GitHubPR[]).filter((item) => !!item.pull_request);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ConnectGitHub({ onConnected }: { onConnected: (cfg: GitHubConfig) => void }) {
  const [username, setUsername] = useState('');
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleConnect = async () => {
    if (!username.trim() || !token.trim()) {
      setError('Both fields are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      // Quick validation call
      const res = await fetch('https://api.github.com/user', {
        headers: { Authorization: `token ${token.trim()}` },
      });
      if (!res.ok) {
        throw new Error('Invalid token or insufficient permissions. Make sure it has the "repo" scope.');
      }
      const cfg: GitHubConfig = { token: token.trim(), username: username.trim() };
      await saveGitHubConfig(cfg);
      onConnected(cfg);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to connect.');
    } finally {
      setSaving(false);
    }
  };

  const openTokenPage = () => {
    chrome.tabs.create({ url: 'https://github.com/settings/tokens' });
  };

  return (
    <div className="border border-theme-border rounded-card p-4 bg-surface space-y-4">
      <div className="flex items-center gap-2">
        <GitPullRequest size={16} className="text-accent" />
        <h2 className="text-sm font-semibold text-text-primary">Connect GitHub</h2>
      </div>
      <p className="text-xs text-text-muted leading-relaxed">
        Connect your GitHub account to see your open pull requests.
      </p>

      <div className="space-y-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-text-secondary">GitHub Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="octocat"
            className="w-full px-2.5 py-1.5 text-xs rounded-card border border-theme-border bg-[var(--color-bg-primary)] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-text-secondary">Personal Access Token</label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="ghp_••••••••••••"
            className="w-full px-2.5 py-1.5 text-xs rounded-card border border-theme-border bg-[var(--color-bg-primary)] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-1.5 text-xs text-red-500">
          <AlertCircle size={12} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <button
          onClick={handleConnect}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-accent text-[var(--color-bg-primary)] rounded-card text-xs font-medium hover:opacity-90 transition-colors disabled:opacity-60"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
          {saving ? 'Connecting…' : 'Connect'}
        </button>
        <button
          onClick={openTokenPage}
          className="text-xs text-accent hover:underline"
        >
          Create a token at github.com/settings/tokens
        </button>
      </div>
    </div>
  );
}

function PRRow({ pr }: { pr: GitHubPR }) {
  const handleClick = () => {
    chrome.tabs.create({ url: pr.html_url });
  };

  return (
    <button
      onClick={handleClick}
      className="w-full text-left border border-theme-border rounded-card px-3 py-2.5 bg-surface hover:bg-accent-container transition-colors space-y-1"
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <span className="shrink-0 inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-accent-container text-accent border border-accent/30 leading-tight">
            {repoName(pr.repository_url)}
          </span>
          <span
            className={`text-xs font-medium leading-snug ${pr.draft ? 'text-text-muted' : 'text-text-primary'}`}
          >
            {pr.title}
          </span>
        </div>
        <span className="shrink-0 text-xs text-text-muted font-mono">#{pr.number}</span>
      </div>

      {/* Bottom row */}
      <div className="flex items-center gap-2.5 text-[10px] text-text-muted">
        <span className="flex items-center gap-1">
          <Clock size={10} />
          {relativeTime(pr.created_at)}
        </span>
        {pr.comments > 0 && (
          <span className="flex items-center gap-1">
            <MessageSquare size={10} />
            {pr.comments}
          </span>
        )}
        {pr.draft && (
          <span className="px-1.5 py-0.5 rounded bg-accent-container text-text-muted text-[10px] font-medium">
            Draft
          </span>
        )}
        {!pr.draft && (
          <span className="text-accent font-medium">Open</span>
        )}
      </div>
    </button>
  );
}

function PRDashboard({ config, onDisconnect }: { config: GitHubConfig; onDisconnect: () => void }) {
  const [activeTab, setActiveTab] = useState<Tab>('authored');
  const [authoredPRs, setAuthoredPRs] = useState<GitHubPR[]>([]);
  const [reviewPRs, setReviewPRs] = useState<GitHubPR[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchPRs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [authored, review] = await Promise.all([
        searchPRs(
          config.token,
          `is:pr is:open author:${config.username}`
        ),
        searchPRs(
          config.token,
          `is:pr is:open review-requested:${config.username}`
        ),
      ]);
      setAuthoredPRs(authored);
      setReviewPRs(review);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch PRs.');
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => {
    fetchPRs();
  }, [fetchPRs]);

  const currentPRs = activeTab === 'authored' ? authoredPRs : reviewPRs;

  return (
    <div className="border border-theme-border rounded-card bg-surface overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-theme-border">
        <GitPullRequest size={14} className="text-accent shrink-0" />
        <span className="text-xs font-semibold text-text-primary flex-1">My PRs</span>
        <button
          onClick={fetchPRs}
          disabled={loading}
          title="Refresh"
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-accent-container transition-colors text-text-muted hover:text-accent disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
        <button
          onClick={onDisconnect}
          title="Disconnect GitHub"
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-accent-container transition-colors text-text-muted hover:text-red-500"
        >
          <LogOut size={12} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-theme-border">
        <button
          onClick={() => setActiveTab('authored')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'authored'
              ? 'border-accent text-accent'
              : 'border-transparent text-text-muted hover:text-text-primary'
          }`}
        >
          <GitPullRequest size={11} />
          Authored
          {authoredPRs.length > 0 && (
            <span className="px-1 rounded-full bg-accent text-[var(--color-bg-primary)] text-[10px] font-bold leading-tight">
              {authoredPRs.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('review')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'review'
              ? 'border-accent text-accent'
              : 'border-transparent text-text-muted hover:text-text-primary'
          }`}
        >
          <Eye size={11} />
          Review Requested
          {reviewPRs.length > 0 && (
            <span className="px-1 rounded-full bg-accent text-[var(--color-bg-primary)] text-[10px] font-bold leading-tight">
              {reviewPRs.length}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="p-2 space-y-1.5">
        {loading && (
          <div className="flex items-center justify-center py-8 gap-2 text-text-muted">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-xs">Loading PRs…</span>
          </div>
        )}

        {!loading && error && (
          <div className="py-4 px-2 space-y-2">
            <div className="flex items-start gap-2 text-xs text-red-500">
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
            <button
              onClick={fetchPRs}
              className="text-xs text-accent hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && currentPRs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 gap-1 text-text-muted">
            <GitPullRequest size={20} className="opacity-40" />
            <span className="text-xs">No open PRs</span>
          </div>
        )}

        {!loading && !error && currentPRs.map((pr) => (
          <PRRow key={pr.id} pr={pr} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function SelfService() {
  const [config, setConfig] = useState<GitHubConfig | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);

  useEffect(() => {
    fetchGitHubConfig().then((cfg) => {
      setConfig(cfg);
      setConfigLoaded(true);
    });
  }, []);

  const handleConnected = (cfg: GitHubConfig) => {
    setConfig(cfg);
  };

  const handleDisconnect = async () => {
    await clearGitHubConfig();
    setConfig(null);
  };

  if (!configLoaded) {
    return (
      <div className="flex items-center justify-center py-12 text-text-muted">
        <Loader2 size={18} className="animate-spin" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex flex-col gap-4">
        <ConnectGitHub onConnected={handleConnected} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PRDashboard config={config} onDisconnect={handleDisconnect} />
    </div>
  );
}
