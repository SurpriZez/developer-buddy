// Developer Buddy — User Script Runner (Content Script)
// Injected into pages via chrome.scripting.registerContentScripts().

const STORAGE_KEY = 'developer_buddy_data';

interface UserScript {
  id: string;
  name: string;
  matchPatterns: string[];
  enabled: boolean;
  body: string;
}

interface StorageData {
  userScripts?: UserScript[];
}

function matchesPattern(url: string, pattern: string): boolean {
  try {
    // Convert match pattern to regex
    // Supports: scheme://host/path with * wildcards
    const escaped = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');
    const regex = new RegExp(`^${escaped}$`);
    return regex.test(url);
  } catch {
    return false;
  }
}

(async () => {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const data: StorageData = result[STORAGE_KEY] ?? {};
    const scripts: UserScript[] = data.userScripts ?? [];
    const currentUrl = window.location.href;

    for (const script of scripts) {
      if (!script.enabled) continue;
      const matches = script.matchPatterns.some((p) =>
        matchesPattern(currentUrl, p)
      );
      if (!matches) continue;

      try {
        // eslint-disable-next-line no-new-func
        new Function(script.body)();
      } catch (err) {
        console.error(`[Developer Buddy] Error in user script "${script.name}":`, err);
      }
    }
  } catch (err) {
    console.error('[Developer Buddy] user-script-runner error:', err);
  }
})();

export {};
