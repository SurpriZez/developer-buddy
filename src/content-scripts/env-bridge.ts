// Developer Buddy — Env Bridge (ISOLATED world)
// Reads the active env profile from chrome.storage and exposes non-secret
// variables to the MAIN world via window.__DB_ENV__.

const STORAGE_KEY = 'developer_buddy_data';

(async () => {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const data = result[STORAGE_KEY] as {
      envProfiles?: { isActive: boolean; variables: { key: string; value: string; secret: boolean }[] }[];
    } | undefined;

    const active = data?.envProfiles?.find((p) => p.isActive);
    if (!active) return;

    const env: Record<string, string> = {};
    for (const v of active.variables) {
      if (!v.secret) env[v.key] = v.value;
    }

    // Inject into MAIN world via a script tag
    const script = document.createElement('script');
    script.textContent = `window.__DB_ENV__ = ${JSON.stringify(env)};`;
    (document.head ?? document.documentElement).appendChild(script);
    script.remove();
  } catch {
    // Non-fatal — getActiveEnv() just returns {}
  }
})();

export {};
