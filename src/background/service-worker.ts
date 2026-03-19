// Developer Buddy — Background Service Worker

import { StorageService } from '../shared/storage/StorageService';
import { syncUserScriptRegistrations } from '../shared/utils/userScriptRegistrar';
import { matchesPattern } from '../shared/utils/matchPattern';
import type { UserScript } from '../shared/types';
import {
  fetchAllConnections,
  getDeployNotificationMessage,
  type DeploymentConnection,
  type DeploymentsConfig,
  type DeploySnapshot,
} from '../shared/deployments/deploymentFetcher';
import { getPRNotificationMessage, type PRSnapshot } from '../shared/pr/prNotificationLogic';

interface PRNotificationState {
  snapshots: Record<string, PRSnapshot>;
}

interface DeployNotificationState {
  snapshots: Record<string, DeploySnapshot>;
}

interface PendingToast {
  id: string;
  title: string;
  message: string;
  url?: string;
}

const PENDING_TOASTS_KEY = 'developer_buddy_pending_toasts';

async function showBrowserToast(id: string, title: string, message: string, url?: string): Promise<void> {
  // Persist so tab switches pick it up
  const result = await chrome.storage.local.get(PENDING_TOASTS_KEY);
  const existing = (result[PENDING_TOASTS_KEY] ?? []) as PendingToast[];
  const toast: PendingToast = { id, title, message, url };
  await chrome.storage.local.set({
    [PENDING_TOASTS_KEY]: [...existing.filter((t) => t.id !== id), toast],
  });

  // Push to the currently active tab
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab?.id || !tab.url?.startsWith('http')) return;

  chrome.tabs.sendMessage(tab.id, { type: 'SHOW_TOAST', ...toast }).catch(() => {
    // Content script not yet loaded (tab predates extension reload) — inject it.
    // The script will read session storage on init and show the toast itself.
    chrome.scripting.executeScript({
      target: { tabId: tab.id! },
      files: ['content-scripts/toast-bridge.js'],
    }).catch(console.error);
  });
}

async function dismissPendingToast(id: string): Promise<void> {
  const result = await chrome.storage.local.get(PENDING_TOASTS_KEY);
  const toasts = (result[PENDING_TOASTS_KEY] ?? []) as PendingToast[];
  await chrome.storage.local.set({
    [PENDING_TOASTS_KEY]: toasts.filter((t) => t.id !== id),
  });
}

// Re-deliver pending toasts when the user switches tabs.
// Always injects the file — the guard in toast-bridge prevents duplicate listeners.
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const result = await chrome.storage.local.get(PENDING_TOASTS_KEY);
    const toasts = (result[PENDING_TOASTS_KEY] ?? []) as PendingToast[];
    if (!toasts.length) return;

    const tab = await chrome.tabs.get(tabId);
    if (!tab.url?.startsWith('http')) return;

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content-scripts/toast-bridge.js'],
    });
  } catch {
    // Tab not injectable (chrome://, PDF, still loading, etc.)
  }
});

const OFFSCREEN_URL = chrome.runtime.getURL('offscreen/offscreen.html');

// Open the side panel when the toolbar icon is clicked
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);

// Clean up any legacy registered content scripts on install
chrome.runtime.onInstalled.addListener((details) => {
  syncUserScriptRegistrations().catch(console.error);

  if (details.reason === 'install') {
    chrome.storage.local.get('developer_buddy_user').then((result) => {
      const user = result['developer_buddy_user'] as { wizardCompleted?: boolean } | undefined;
      if (!user?.wizardCompleted) {
        chrome.tabs.create({ url: chrome.runtime.getURL('wizard/wizard.html') });
      }
    }).catch(console.error);
  }

  // Create the buddy-notify alarm (clears any legacy 'pr-notify' from prior versions)
  chrome.alarms.clear('pr-notify');
  chrome.alarms.get('buddy-notify', (existing) => {
    if (!existing) chrome.alarms.create('buddy-notify', { periodInMinutes: 2 });
  });
});

// Re-sync when userScripts change in storage
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes['developer_buddy_data']) {
    const newVal = changes['developer_buddy_data'].newValue as { userScripts?: unknown } | undefined;
    const oldVal = changes['developer_buddy_data'].oldValue as { userScripts?: unknown } | undefined;
    if (JSON.stringify(newVal?.userScripts) !== JSON.stringify(oldVal?.userScripts)) {
      syncUserScriptRegistrations().catch(console.error);
    }
  }
});

// --- User script execution via tabs.onUpdated ---
// This runs scripts in MAIN world via executeScript, which:
//   1. Works even on pages with strict CSP (Google, etc.)
//   2. Has full access to window/document/page globals
//   3. Doesn't require chrome.storage in the page world

function shouldRun(script: UserScript, status: string): boolean {
  if (script.runAt === 'document-idle')  return status === 'complete';
  if (script.runAt === 'document-end')   return status === 'loading';
  if (script.runAt === 'document-start') return status === 'loading';
  return false;
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  const url = tab.url;
  if (!url || !changeInfo.status) return;
  // Ignore extension pages and non-http URLs
  if (!url.startsWith('http://') && !url.startsWith('https://')) return;

  let userScripts: UserScript[];
  try {
    userScripts = await StorageService.getUserScripts();
  } catch {
    return;
  }

  for (const script of userScripts) {
    if (!script.enabled || !script.matchPatterns.length) continue;
    if (!shouldRun(script, changeInfo.status)) continue;
    if (!script.matchPatterns.some((p) => matchesPattern(url, p))) continue;

    const body = script.body;
    chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: (scriptBody: string) => {
        try {
          // eslint-disable-next-line no-new-func
          new Function(scriptBody)();
        } catch (e) {
          console.error('[Developer Buddy RPA] Script error:', e);
        }
      },
      args: [body],
    }).catch((err) => {
      console.warn(`[Developer Buddy] Failed to inject script "${script.name}":`, err);
    });
  }
});

// --- Offscreen document for Script Runner ---

async function ensureOffscreenDocument(): Promise<void> {
  const existing = await chrome.offscreen.hasDocument();
  if (!existing) {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: [chrome.offscreen.Reason.BLOBS],
      justification: 'Execute JavaScript scripts in a sandboxed context (MV3 offscreen document)',
    });
  }
}

async function handleRunScript(
  message: { payload: { id: string; body: string; language: string } },
  sendResponse: (r: unknown) => void
): Promise<void> {
  if (message.payload.language === 'shell') {
    sendResponse({
      output: [],
      error: 'Shell execution requires the Developer Buddy companion agent, which is available in Phase 2.',
    });
    return;
  }
  try {
    await ensureOffscreenDocument();
    const result = await chrome.runtime.sendMessage({
      type: 'EXECUTE_SCRIPT',
      payload: { body: message.payload.body },
    });
    sendResponse(result);
  } catch (err) {
    sendResponse({ output: [], error: String(err) });
  }
}

async function handleNotification(payload: { title: string; message: string }): Promise<void> {
  await showBrowserToast(`db-notif-${Date.now()}`, payload.title, payload.message);
}

chrome.notifications.onClicked.addListener((notificationId) => {
  const colonIdx = notificationId.indexOf(':');
  if (colonIdx !== -1) {
    const url = notificationId.slice(colonIdx + 1);
    if (url.startsWith('http')) {
      chrome.tabs.create({ url });
    }
  }
  chrome.notifications.clear(notificationId);
});

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
            await showBrowserToast(
              `pr-notify:${pr.html_url}`,
              notification.title,
              notification.message,
              pr.html_url,
            );
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
        await showBrowserToast(
          `deploy-notify:${item.url}`,
          notification.title,
          notification.message,
          item.url,
        );
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

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'buddy-notify') {
    runPRNotifyPoll().catch(console.error);
    runDeployNotifyPoll().catch(console.error);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'RUN_SCRIPT':
      handleRunScript(message, sendResponse);
      break;
    case 'DB_NOTIFICATION':
      handleNotification(message.payload).then(() => sendResponse({ ok: true })).catch(console.error);
      break;
    case 'TOAST_DISMISSED':
      dismissPendingToast(message.id).catch(console.error);
      sendResponse({ ok: true });
      break;
    case 'DB_GET_ACTIVE_ENV':
      StorageService.getActiveProfile().then((profile) => {
        if (!profile) { sendResponse({ variables: [] }); return; }
        const vars = profile.variables
          .filter((v) => !v.secret)
          .map((v) => ({ key: v.key, value: v.value }));
        sendResponse({ variables: vars });
      }).catch(() => sendResponse({ variables: [] }));
      break;
    default:
      return false;
  }
  return true;
});
