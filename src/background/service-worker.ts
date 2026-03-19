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
  const url = notificationId.slice(notificationId.indexOf(':') + 1);
  if (url.startsWith('http')) {
    chrome.tabs.create({ url });
  }
  chrome.notifications.clear(notificationId);
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
