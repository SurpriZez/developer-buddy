// Developer Buddy — Grant Bridge
// Runs in MAIN world (world: "MAIN") so window.DB is visible to user scripts.
// Uses browser-native APIs only — no chrome.* access in MAIN world.

interface DBApi {
  setValue(key: string, value: unknown): void;
  getValue(key: string): unknown;
  deleteValue(key: string): void;
  openInTab(url: string): void;
  setClipboard(text: string): Promise<void>;
  notification(title: string, message: string): void;
  getActiveEnv(): Record<string, string>;
  xmlhttpRequest(details: unknown): null;
}

declare global {
  interface Window {
    DB: DBApi;
    __DB_ENV__?: Record<string, string>;
  }
}

const KV_PREFIX = 'db_us_kv_';

const DB: DBApi = {
  setValue(key: string, value: unknown): void {
    try {
      localStorage.setItem(`${KV_PREFIX}${key}`, JSON.stringify(value));
    } catch (e) {
      console.error('[Developer Buddy] DB.setValue error:', e);
    }
  },

  getValue(key: string): unknown {
    try {
      const raw = localStorage.getItem(`${KV_PREFIX}${key}`);
      return raw !== null ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  deleteValue(key: string): void {
    localStorage.removeItem(`${KV_PREFIX}${key}`);
  },

  openInTab(url: string): void {
    window.open(url, '_blank');
  },

  async setClipboard(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for pages without clipboard permission
      const el = document.createElement('textarea');
      el.value = text;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
  },

  notification(title: string, message: string): void {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(title, { body: message });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then((perm) => {
          if (perm === 'granted') new Notification(title, { body: message });
        });
      }
    }
  },

  getActiveEnv(): Record<string, string> {
    // Populated by the ISOLATED world bridge via window.__DB_ENV__
    return window.__DB_ENV__ ?? {};
  },

  xmlhttpRequest(_details: unknown): null {
    console.log('[Developer Buddy] DB.xmlhttpRequest is available in Phase 2.');
    return null;
  },
};

window.DB = DB;

export {};
