/**
 * Tests a URL against a Chrome match pattern.
 * Supports: scheme://host/path with * wildcards, <all_urls>
 */
export function matchesPattern(url: string, pattern: string): boolean {
  if (pattern === '<all_urls>') return true;
  try {
    // Escape everything except * then replace * with .*
    const regexStr = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');
    return new RegExp(`^${regexStr}$`).test(url);
  } catch {
    return false;
  }
}
