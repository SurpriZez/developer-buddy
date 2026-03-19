// Developer Buddy — Toast Bridge
// Runs in ISOLATED world on all web pages.
// On load: checks chrome.storage.session for pending toasts and shows them.
// Listens for SHOW_TOAST messages from the background service worker.
// Sends TOAST_DISMISSED back when the user dismisses or auto-dismiss fires.

const TOAST_CONTAINER_ID = 'db-toast-container';
const TOAST_STYLE_ID = 'db-toast-styles';
const PENDING_TOASTS_KEY = 'developer_buddy_pending_toasts';

interface PendingToast {
  id: string;
  title: string;
  message: string;
  url?: string;
}

function ensureStyles(): void {
  if (document.getElementById(TOAST_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = TOAST_STYLE_ID;
  style.textContent = `
    #db-toast-container {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
    }
    .db-toast {
      background: #1e1e2e;
      color: #cdd6f4;
      border-left: 4px solid #89b4fa;
      border-radius: 8px;
      padding: 12px 36px 12px 16px;
      min-width: 280px;
      max-width: 360px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px;
      line-height: 1.4;
      opacity: 1;
      transition: opacity 0.4s ease, transform 0.4s ease;
      transform: translateX(0);
      pointer-events: auto;
      cursor: default;
      position: relative;
    }
    .db-toast--clickable { cursor: pointer; }
    .db-toast--hiding { opacity: 0; transform: translateX(20px); }
    .db-toast-title {
      font-weight: 600;
      font-size: 13px;
      margin-bottom: 4px;
      color: #89b4fa;
    }
    .db-toast-message { color: #cdd6f4; }
    .db-toast-close {
      position: absolute;
      top: 8px;
      right: 10px;
      background: none;
      border: none;
      color: #6c7086;
      cursor: pointer;
      font-size: 16px;
      line-height: 1;
      padding: 0;
    }
    .db-toast-close:hover { color: #cdd6f4; }
  `;
  document.head.appendChild(style);
}

function ensureContainer(): HTMLElement {
  let container = document.getElementById(TOAST_CONTAINER_ID);
  if (!container) {
    container = document.createElement('div');
    container.id = TOAST_CONTAINER_ID;
    document.body.appendChild(container);
  }
  return container;
}

function showToast(toast: PendingToast): void {
  const { id, title, message, url } = toast;
  if (document.getElementById('db-toast-' + id)) return; // already showing

  ensureStyles();
  const container = ensureContainer();

  const el = document.createElement('div');
  el.id = 'db-toast-' + id;
  el.className = 'db-toast' + (url ? ' db-toast--clickable' : '');

  const closeBtn = document.createElement('button');
  closeBtn.className = 'db-toast-close';
  closeBtn.title = 'Dismiss';
  closeBtn.textContent = '\u2715';

  const titleEl = document.createElement('div');
  titleEl.className = 'db-toast-title';
  titleEl.textContent = title;

  const msgEl = document.createElement('div');
  msgEl.className = 'db-toast-message';
  msgEl.textContent = message;

  el.appendChild(closeBtn);
  el.appendChild(titleEl);
  el.appendChild(msgEl);
  container.appendChild(el);

  const dismiss = (): void => {
    el.classList.add('db-toast--hiding');
    setTimeout(() => el.remove(), 400);
    chrome.runtime.sendMessage({ type: 'TOAST_DISMISSED', id }).catch(() => {});
  };

  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dismiss();
  });

  if (url) {
    el.addEventListener('click', () => {
      window.open(url, '_blank');
      dismiss();
    });
  }

  setTimeout(dismiss, 6000);
}

// On page load: show any toasts that are still pending (handles tab switches)
chrome.storage.session.get(PENDING_TOASTS_KEY).then((result) => {
  const toasts = (result[PENDING_TOASTS_KEY] ?? []) as PendingToast[];
  for (const toast of toasts) showToast(toast);
}).catch(() => {});

// Listen for new toasts pushed from the background service worker
chrome.runtime.onMessage.addListener((message: { type: string } & PendingToast) => {
  if (message.type === 'SHOW_TOAST') {
    showToast({ id: message.id, title: message.title, message: message.message, url: message.url });
  }
});

export {};
