import type { UserScript, UserScriptRunAt, UserScriptGrant } from '../types';

const VALID_GRANTS: UserScriptGrant[] = [
  'DB_setValue',
  'DB_getValue',
  'DB_deleteValue',
  'DB_xmlhttpRequest',
  'DB_openInTab',
  'DB_setClipboard',
  'DB_notification',
  'DB_getActiveEnv',
];

export function parseUserScript(body: string): Partial<UserScript> {
  const result: Partial<UserScript> = {};

  const blockMatch = body.match(/==UserScript==([\s\S]*?)==\/UserScript==/);
  if (!blockMatch) return result;

  const block = blockMatch[1];
  const lines = block.split('\n');

  const matchPatterns: string[] = [];
  const grants: UserScriptGrant[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line.startsWith('@') && !line.startsWith('// @')) continue;

    // Normalize: strip leading "// " if present
    const normalized = line.replace(/^\/\/\s*/, '');
    const spaceIdx = normalized.indexOf(' ');
    if (spaceIdx === -1) continue;

    const directive = normalized.slice(0, spaceIdx).trim();
    const value = normalized.slice(spaceIdx).trim();

    switch (directive) {
      case '@name':
        result.name = value;
        break;
      case '@description':
        result.description = value;
        break;
      case '@version':
        result.version = value;
        break;
      case '@match':
      case '@include':
        matchPatterns.push(value);
        break;
      case '@run-at': {
        const validRunAt: UserScriptRunAt[] = [
          'document-start',
          'document-end',
          'document-idle',
        ];
        if (validRunAt.includes(value as UserScriptRunAt)) {
          result.runAt = value as UserScriptRunAt;
        } else {
          result.runAt = 'document-idle';
        }
        break;
      }
      case '@grant': {
        if (VALID_GRANTS.includes(value as UserScriptGrant)) {
          grants.push(value as UserScriptGrant);
        } else {
          console.warn(`[Developer Buddy] Unknown grant: ${value}`);
        }
        break;
      }
      default:
        break;
    }
  }

  result.matchPatterns = matchPatterns;
  result.grants = grants;
  if (!result.runAt) result.runAt = 'document-idle';

  return result;
}
