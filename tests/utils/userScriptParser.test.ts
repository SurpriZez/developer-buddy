import { parseUserScript } from '../../src/shared/utils/userScriptParser';

const FULL_HEADER = `
// ==UserScript==
// @name         Add Copy cURL Button
// @description  Adds a Copy as cURL button to the internal API explorer
// @version      1.2.0
// @match        https://internal.example.com/api-explorer/*
// @match        https://internal.example.com/api/*
// @include      https://staging.example.com/*
// @run-at       document-idle
// @grant        DB_setClipboard
// @grant        DB_getValue
// ==/UserScript==

(function() { 'use strict'; })();
`.trim();

describe('parseUserScript()', () => {
  it('parses @name correctly', () => {
    const result = parseUserScript(FULL_HEADER);
    expect(result.name).toBe('Add Copy cURL Button');
  });

  it('parses @description correctly', () => {
    const result = parseUserScript(FULL_HEADER);
    expect(result.description).toBe('Adds a Copy as cURL button to the internal API explorer');
  });

  it('parses @version correctly', () => {
    const result = parseUserScript(FULL_HEADER);
    expect(result.version).toBe('1.2.0');
  });

  it('parses multiple @match entries into an array', () => {
    const result = parseUserScript(FULL_HEADER);
    expect(result.matchPatterns).toContain('https://internal.example.com/api-explorer/*');
    expect(result.matchPatterns).toContain('https://internal.example.com/api/*');
  });

  it('treats @include the same as @match', () => {
    const result = parseUserScript(FULL_HEADER);
    expect(result.matchPatterns).toContain('https://staging.example.com/*');
  });

  it('parses @run-at correctly', () => {
    const result = parseUserScript(FULL_HEADER);
    expect(result.runAt).toBe('document-idle');
  });

  it('parses multiple @grant entries into an array', () => {
    const result = parseUserScript(FULL_HEADER);
    expect(result.grants).toContain('DB_setClipboard');
    expect(result.grants).toContain('DB_getValue');
  });

  it('ignores unknown @grant values', () => {
    const script = `
// ==UserScript==
// @name  Test
// @match https://example.com/*
// @grant UNKNOWN_GRANT
// @grant DB_setClipboard
// ==/UserScript==
    `.trim();
    const result = parseUserScript(script);
    expect(result.grants).not.toContain('UNKNOWN_GRANT');
    expect(result.grants).toContain('DB_setClipboard');
  });

  it('returns empty matchPatterns when no @match is present', () => {
    const script = `
// ==UserScript==
// @name  No Match
// ==/UserScript==
    `.trim();
    const result = parseUserScript(script);
    expect(result.matchPatterns).toEqual([]);
  });

  it('handles missing optional fields without crashing', () => {
    const script = `
// ==UserScript==
// @match https://example.com/*
// ==/UserScript==
    `.trim();
    expect(() => parseUserScript(script)).not.toThrow();
    const result = parseUserScript(script);
    expect(result.name).toBeUndefined();
    expect(result.description).toBeUndefined();
    expect(result.version).toBeUndefined();
  });

  it('defaults @run-at to document-idle when not specified', () => {
    const script = `
// ==UserScript==
// @name  Test
// @match https://example.com/*
// ==/UserScript==
    `.trim();
    const result = parseUserScript(script);
    expect(result.runAt).toBe('document-idle');
  });

  it('returns empty grants array when no @grant is declared', () => {
    const script = `
// ==UserScript==
// @name  Test
// @match https://example.com/*
// ==/UserScript==
    `.trim();
    const result = parseUserScript(script);
    expect(result.grants).toEqual([]);
  });

  it('handles @grant none gracefully', () => {
    const script = `
// ==UserScript==
// @name  Test
// @match https://example.com/*
// @grant none
// ==/UserScript==
    `.trim();
    const result = parseUserScript(script);
    expect(result.grants).toEqual([]);
  });
});
