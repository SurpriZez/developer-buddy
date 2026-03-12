import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { parseUserScript } from '../../../shared/utils/userScriptParser';
import type { UserScript, UserScriptGrant } from '../../../shared/types';
import { generateId } from '../../../shared/utils/id';

const STARTER_TEMPLATE = `// ==UserScript==
// @name         My Script
// @description  Describe what this script does
// @version      1.0.0
// @match        https://example.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';
  // Your code here
  console.log('[Developer Buddy] Script running on', window.location.href);
})();
`;

const GRANT_DESCRIPTIONS: Record<UserScriptGrant, string> = {
  DB_setValue:      'Store persistent data scoped to this script',
  DB_getValue:      'Read previously stored script data',
  DB_deleteValue:   'Delete stored script data',
  DB_xmlhttpRequest:'Cross-origin HTTP requests (Phase 2)',
  DB_openInTab:     'Open a URL in a new browser tab',
  DB_setClipboard:  'Write text to the clipboard',
  DB_notification:  'Show a browser notification',
  DB_getActiveEnv:  'Read active environment variables (non-secret)',
};

const ALL_GRANTS = Object.keys(GRANT_DESCRIPTIONS) as UserScriptGrant[];

interface Props {
  script: UserScript | null;
  initialBody?: string;
  onSave: (script: UserScript) => void;
  onCancel: () => void;
}

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-theme-border rounded-card overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-[var(--color-bg-primary)] hover:bg-accent-container transition-colors text-left"
      >
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">{title}</span>
        {open ? <ChevronUp size={14} className="text-text-muted" /> : <ChevronDown size={14} className="text-text-muted" />}
      </button>
      {open && <div className="px-4 py-3">{children}</div>}
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs text-blue-700 leading-relaxed">
      <HelpCircle size={13} className="shrink-0 mt-0.5 text-blue-400" />
      <span>{children}</span>
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="bg-accent-container text-text-primary font-mono px-1 py-0.5 rounded text-xs">{children}</code>;
}

export function UserScriptEditor({ script, initialBody, onSave, onCancel }: Props) {
  const [body, setBody] = useState(script?.body ?? initialBody ?? STARTER_TEMPLATE);
  const [error, setError] = useState('');

  const parsed = parseUserScript(body);

  const handleSave = () => {
    if (!parsed.matchPatterns || parsed.matchPatterns.length === 0) {
      setError('At least one @match pattern is required.');
      return;
    }
    const now = new Date().toISOString();
    const saved: UserScript = {
      id: script?.id ?? generateId(),
      name: parsed.name ?? 'Unnamed Script',
      description: parsed.description ?? '',
      version: parsed.version ?? '1.0.0',
      matchPatterns: parsed.matchPatterns ?? [],
      runAt: parsed.runAt ?? 'document-idle',
      enabled: script?.enabled ?? true,
      body,
      grants: parsed.grants ?? [],
      installedAt: script?.installedAt ?? now,
      updatedAt: now,
    };
    onSave(saved);
  };

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-text-primary">
          {script ? 'Edit RPA Script' : 'New RPA Script'}
        </h2>
      </div>

      {/* What is an RPA script? */}
      <Section title="What is an RPA Script?">
        <div className="space-y-2 text-xs text-text-secondary leading-relaxed">
          <p>
            RPA scripts are JavaScript snippets that <strong>automatically run on web pages</strong> that match your
            configured URL patterns — similar to Tampermonkey or Greasemonkey.
          </p>
          <p>
            Unlike the Scripts module (which you run manually), RPA scripts trigger silently in the background
            whenever you visit a matching page. Use them to modify page behaviour, extract data, add UI elements,
            or automate repetitive actions.
          </p>
          <Tip>
            Your script runs inside the page — it has full access to <Code>window</Code>, <Code>document</Code>,
            and the page's own JavaScript. Changes you make affect only your browser.
          </Tip>
        </div>
      </Section>

      {/* Metadata header reference */}
      <Section title="Metadata Header Reference">
        <div className="space-y-3 text-xs text-text-secondary">
          <p>Every RPA script starts with a <Code>{'==UserScript=='}</Code> header block that controls how it runs.</p>

          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-[var(--color-bg-primary)] text-left">
                <th className="border border-theme-border px-2 py-1.5 font-semibold text-text-secondary w-36">Tag</th>
                <th className="border border-theme-border px-2 py-1.5 font-semibold text-text-secondary">Description</th>
                <th className="border border-theme-border px-2 py-1.5 font-semibold text-text-secondary w-28">Example</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {[
                ['@name', 'Display name of your script', 'My Helper'],
                ['@description', 'What the script does', 'Adds a copy button'],
                ['@version', 'Semantic version number', '1.0.0'],
                ['@match', 'URL pattern this script runs on (repeatable)', 'https://example.com/*'],
                ['@include', 'Alias for @match', 'https://*.example.com/*'],
                ['@run-at', 'When to inject: document-start | document-end | document-idle', 'document-idle'],
                ['@grant', 'Developer Buddy API to expose (repeatable, or "none")', 'DB_setClipboard'],
              ].map(([tag, desc, example]) => (
                <tr key={tag} className="align-top">
                  <td className="border border-theme-border px-2 py-1.5 text-accent font-semibold">{tag}</td>
                  <td className="border border-theme-border px-2 py-1.5 font-sans text-text-secondary">{desc}</td>
                  <td className="border border-theme-border px-2 py-1.5 text-text-muted">{example}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <Tip>
            URL patterns use <Code>*</Code> as a wildcard. <Code>https://example.com/*</Code> matches all paths
            on example.com. <Code>https://*.example.com/*</Code> also matches subdomains.
          </Tip>

          <div>
            <p className="font-medium text-text-secondary mb-1">run-at values explained:</p>
            <ul className="space-y-1 pl-3">
              <li><Code>document-start</Code> — runs before the DOM is built (fastest, but DOM not ready)</li>
              <li><Code>document-end</Code> — runs after the DOM is parsed but before images load</li>
              <li><Code>document-idle</Code> — runs after the page fully loads <span className="text-text-muted">(default, safest)</span></li>
            </ul>
          </div>
        </div>
      </Section>

      {/* Grant reference */}
      <Section title="Available Grants (window.DB API)" defaultOpen={false}>
        <div className="space-y-3 text-xs text-text-secondary">
          <p>
            Declare grants with <Code>@grant DB_grantName</Code> in the header. Only declared grants are
            available at runtime via the <Code>window.DB</Code> object. Use <Code>@grant none</Code> if your
            script needs no Developer Buddy APIs.
          </p>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-[var(--color-bg-primary)] text-left">
                <th className="border border-theme-border px-2 py-1.5 font-semibold text-text-secondary w-40">Grant</th>
                <th className="border border-theme-border px-2 py-1.5 font-semibold text-text-secondary">What it gives you</th>
                <th className="border border-theme-border px-2 py-1.5 font-semibold text-text-secondary w-44">Usage</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {ALL_GRANTS.map((g) => (
                <tr key={g} className="align-top">
                  <td className="border border-theme-border px-2 py-1.5 text-accent font-semibold">{g}</td>
                  <td className="border border-theme-border px-2 py-1.5 font-sans text-text-secondary">{GRANT_DESCRIPTIONS[g]}</td>
                  <td className="border border-theme-border px-2 py-1.5 text-text-muted">
                    {g === 'DB_setValue'      && 'DB.setValue("key", val)'}
                    {g === 'DB_getValue'      && 'DB.getValue("key")'}
                    {g === 'DB_deleteValue'   && 'DB.deleteValue("key")'}
                    {g === 'DB_xmlhttpRequest'&& 'DB.xmlhttpRequest({...})'}
                    {g === 'DB_openInTab'     && 'DB.openInTab("https://...")'}
                    {g === 'DB_setClipboard'  && 'await DB.setClipboard(text)'}
                    {g === 'DB_notification'  && 'DB.notification("Title", "Msg")'}
                    {g === 'DB_getActiveEnv'  && 'DB.getActiveEnv()["KEY"]'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Tip>
            <Code>DB.getActiveEnv()</Code> returns a key→value object of your active environment profile's
            non-secret variables. Switch profiles in the side panel and your script picks up the new values
            on the next page load.
          </Tip>
        </div>
      </Section>

      {/* Editor + live preview side by side */}
      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          <label className="block text-xs font-semibold text-text-secondary mb-1.5">Script</label>
          <textarea
            value={body}
            onChange={(e) => { setBody(e.target.value); setError(''); }}
            rows={22}
            spellCheck={false}
            className="w-full border border-theme-border rounded-card px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-accent resize-y bg-gray-900 text-green-400 leading-relaxed"
          />
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>

        {/* Live metadata preview */}
        <div className="w-56 shrink-0 space-y-3">
          <p className="text-xs font-semibold text-text-secondary">Live Preview</p>

          <div className="border border-theme-border rounded-card p-3 space-y-3 text-xs">
            <div>
              <p className="text-text-muted mb-0.5">Name</p>
              <p className="font-medium text-text-primary break-words">
                {parsed.name ?? <span className="text-text-muted italic">not set</span>}
              </p>
            </div>

            <div>
              <p className="text-text-muted mb-0.5">Version</p>
              <p className="font-mono text-text-secondary">{parsed.version ?? <span className="text-text-muted italic">not set</span>}</p>
            </div>

            <div>
              <p className="text-text-muted mb-0.5">Run at</p>
              <p className="font-mono text-text-secondary">{parsed.runAt ?? 'document-idle'}</p>
            </div>

            <div>
              <p className="text-text-muted mb-0.5">Match Patterns</p>
              {(!parsed.matchPatterns || parsed.matchPatterns.length === 0) ? (
                <p className="text-red-400 italic">none — required</p>
              ) : (
                <ul className="space-y-1 mt-1">
                  {parsed.matchPatterns.map((p, i) => (
                    <li key={i} className="font-mono text-text-secondary break-all bg-accent-container rounded px-1.5 py-0.5 text-xs">
                      {p}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <p className="text-text-muted mb-0.5">Grants</p>
              {(!parsed.grants || parsed.grants.length === 0) ? (
                <p className="text-text-muted italic">none</p>
              ) : (
                <div className="flex flex-wrap gap-1 mt-1">
                  {parsed.grants.map((g) => (
                    <span key={g} className="bg-accent-container text-accent border border-accent px-1.5 py-0.5 rounded font-mono text-xs">
                      {g}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-accent text-[var(--color-bg-primary)] rounded-lg text-sm font-medium hover:opacity-90 transition-colors"
        >
          Save Script
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-accent-container text-text-secondary rounded-lg text-sm font-medium hover:bg-accent-container transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
