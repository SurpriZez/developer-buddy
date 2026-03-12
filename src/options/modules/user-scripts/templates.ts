export interface ScriptTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  body: string;
}

export const SCRIPT_TEMPLATES: ScriptTemplate[] = [
  {
    id: 'github-copy-branch',
    name: 'GitHub PR — Copy Branch Name',
    description: 'Adds a "Copy Branch" button next to the PR title on GitHub pull request pages.',
    category: 'GitHub',
    body: `// ==UserScript==
// @name         GitHub PR — Copy Branch Name
// @description  Adds a Copy Branch button next to the PR title
// @version      1.0.0
// @match        https://github.com/*/*/pull/*
// @run-at       document-idle
// @grant        DB_setClipboard
// ==/UserScript==

(function () {
  'use strict';

  function addCopyButton() {
    if (document.getElementById('db-copy-branch-btn')) return;

    const branchEl = document.querySelector('.head-ref, [data-testid="head-ref"], .commit-ref.head-ref');
    if (!branchEl) return;

    const branchName = branchEl.textContent?.trim();
    if (!branchName) return;

    const btn = document.createElement('button');
    btn.id = 'db-copy-branch-btn';
    btn.textContent = '📋 Copy Branch';
    btn.style.cssText = \`
      margin-left: 8px;
      padding: 2px 10px;
      font-size: 12px;
      border-radius: 6px;
      border: 1px solid #30363d;
      background: #21262d;
      color: #c9d1d9;
      cursor: pointer;
    \`;
    btn.addEventListener('click', async () => {
      await window.DB.setClipboard(branchName);
      btn.textContent = '✅ Copied!';
      setTimeout(() => { btn.textContent = '📋 Copy Branch'; }, 1500);
    });

    branchEl.parentElement?.appendChild(btn);
  }

  addCopyButton();

  const observer = new MutationObserver(addCopyButton);
  observer.observe(document.body, { childList: true, subtree: true });
})();
`,
  },
  {
    id: 'github-highlight-my-prs',
    name: 'GitHub — Highlight My PRs',
    description: 'Highlights pull requests you authored in PR list pages. Set GITHUB_USERNAME in your active env profile.',
    category: 'GitHub',
    body: `// ==UserScript==
// @name         GitHub — Highlight My PRs
// @description  Highlights pull requests you authored in PR lists
// @version      1.0.0
// @match        https://github.com/*/*/pulls*
// @run-at       document-idle
// @grant        DB_getActiveEnv
// ==/UserScript==

(function () {
  'use strict';

  // Set GITHUB_USERNAME in your active environment profile
  const env = window.DB.getActiveEnv();
  const username = env['GITHUB_USERNAME'];
  if (!username) {
    console.warn('[Developer Buddy] Set GITHUB_USERNAME in your active env profile.');
    return;
  }

  document.querySelectorAll('[data-hovercard-type="pull_request"]').forEach((pr) => {
    const row = pr.closest('li');
    const authorEl = row?.querySelector('.opened-by a, [data-hovercard-type="user"]');
    if (authorEl?.textContent?.trim() === username && row) {
      row.style.background = 'rgba(88, 166, 255, 0.08)';
      row.style.borderLeft = '3px solid #388bfd';
    }
  });
})();
`,
  },
  {
    id: 'github-auto-expand-diffs',
    name: 'GitHub — Auto-expand Diffs',
    description: 'Automatically expands all collapsed file diffs on GitHub pull request file pages.',
    category: 'GitHub',
    body: `// ==UserScript==
// @name         GitHub — Auto-expand Diffs
// @description  Automatically expands collapsed file diffs on PR pages
// @version      1.0.0
// @match        https://github.com/*/*/pull/*/files
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  function expandAll() {
    document.querySelectorAll('button[aria-label="Toggle diff contents"]').forEach((btn) => {
      if (btn.getAttribute('aria-expanded') === 'false') {
        (btn as HTMLElement).click();
      }
    });
  }

  setTimeout(expandAll, 1000);
})();
`,
  },
  {
    id: 'page-word-count',
    name: 'Page Word Count Badge',
    description: 'Shows a floating word count badge on any page — useful for reading long docs or articles.',
    category: 'Productivity',
    body: `// ==UserScript==
// @name         Page Word Count Badge
// @description  Shows a floating word count badge on any webpage
// @version      1.0.0
// @match        https://*/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const text = document.body.innerText || '';
  const words = text.trim().split(/\\s+/).filter(Boolean).length;

  const badge = document.createElement('div');
  badge.textContent = \`\${words.toLocaleString()} words\`;
  badge.style.cssText = \`
    position: fixed;
    bottom: 16px;
    right: 16px;
    padding: 6px 12px;
    background: rgba(0,0,0,0.75);
    color: #fff;
    font-size: 12px;
    font-family: monospace;
    border-radius: 8px;
    z-index: 999999;
    pointer-events: none;
    backdrop-filter: blur(4px);
  \`;
  document.body.appendChild(badge);
})();
`,
  },
  {
    id: 'console-error-notifier',
    name: 'Console Error Notifier',
    description: 'Shows a desktop notification when a JavaScript error occurs on the page — great for debugging.',
    category: 'Utilities',
    body: `// ==UserScript==
// @name         Console Error Notifier
// @description  Desktop notification when a JS error occurs on the page
// @version      1.0.0
// @match        https://*/*
// @run-at       document-start
// @grant        DB_notification
// ==/UserScript==

(function () {
  'use strict';

  window.addEventListener('error', (event) => {
    window.DB.notification(
      'JS Error Detected',
      event.message + (event.filename ? \`\\n\${event.filename}:\${event.lineno}\` : '')
    );
  });
})();
`,
  },
];
