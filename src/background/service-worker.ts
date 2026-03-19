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
  await chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon48.png'),
    title: payload.title,
    message: payload.message,
  });
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

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'buddy-notify') {
    runPRNotifyPoll().catch(console.error);
    // runDeployNotifyPoll added in Task 6
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
