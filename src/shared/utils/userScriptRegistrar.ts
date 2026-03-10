// Cleans up any previously registered "db-us-*" content scripts.
// User script bodies are now executed via chrome.scripting.executeScript
// in the service worker's tabs.onUpdated listener instead.

const PREFIX = 'db-us-';

export async function syncUserScriptRegistrations(): Promise<void> {
  try {
    const registered = await chrome.scripting.getRegisteredContentScripts();
    const ours = registered
      .filter((s) => (s.id ?? '').startsWith(PREFIX))
      .map((s) => s.id as string);

    if (ours.length > 0) {
      await chrome.scripting.unregisterContentScripts({ ids: ours });
    }
  } catch (err) {
    console.error('[Developer Buddy] syncUserScriptRegistrations error:', err);
  }
}
