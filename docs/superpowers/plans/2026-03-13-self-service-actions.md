# Self-Service Actions Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add configurable one-click HTTP action buttons — defined in Settings, triggered from a new "Actions" tab in the side panel — with inline status + truncated response display.

**Architecture:** New `ActionVariable[]` and `SelfServiceAction[]` are stored in the existing `developer_buddy_data` storage key alongside all other data. The settings page gets a new "Actions" section (variable store + CRUD list/editor). The side panel gets a new top-level module that fires the stored actions via `fetch()` and renders the result inline.

**Tech Stack:** React + TypeScript, Tailwind CSS v3, `chrome.storage.local` via `StorageService`, existing `interpolate()` utility, lucide-react icons, Jest + ts-jest for storage tests.

**Spec:** `docs/superpowers/specs/2026-03-13-self-service-actions-design.md`

---

## Chunk 1: Data Layer — Types + StorageService + Tests

### Task 1: Extend shared types

**Files:**
- Modify: `src/shared/types/index.ts`

- [ ] **Step 1: Add `ActionVariable` and `SelfServiceAction` interfaces, and extend `StorageSchema`**

Open `src/shared/types/index.ts`. Add the following at the end of the file, before the closing of the root storage schema:

```ts
// --- Self-Service Actions ---

export interface ActionVariable {
  key: string;
  value: string;
  secret: boolean;
}

export interface SelfServiceAction {
  id: string;
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;               // supports {{VAR_NAME}} interpolation
  headers: { key: string; value: string; enabled: boolean }[];
  body: string;              // empty string = no body; used for POST/PUT/PATCH only
  confirmationPrompt: string; // empty string = no confirmation required
  createdAt: string;         // ISO8601
  updatedAt: string;         // ISO8601
}
```

Then extend the existing `StorageSchema` interface (at the bottom of the file) with two new fields:

```ts
export interface StorageSchema {
  scripts: Script[];
  envProfiles: EnvProfile[];
  apiRequests: ApiRequest[];
  apiCollections: ApiCollection[];
  docSources: DocSource[];
  userScripts: UserScript[];
  selfServiceActions: SelfServiceAction[]; // ADD
  actionVariables: ActionVariable[];       // ADD
}
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
cmd.exe /c "cd E:\work\developer-buddy && npx tsc --noEmit"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/shared/types/index.ts
git commit -m "feat(actions): add ActionVariable and SelfServiceAction types"
```

---

### Task 2: Update StorageService

**Files:**
- Modify: `src/shared/storage/StorageService.ts`

- [ ] **Step 1: Update imports at top of `StorageService.ts`**

Add the two new types to the import line:

```ts
import type {
  StorageSchema,
  Script,
  EnvProfile,
  ApiRequest,
  ApiCollection,
  DocSource,
  UserScript,
  SelfServiceAction,  // ADD
  ActionVariable,     // ADD
} from '../types';
```

- [ ] **Step 2: Update `DEFAULTS` constant**

The `DEFAULTS` constant (currently lines 13–20) must include the two new arrays:

```ts
const DEFAULTS: StorageSchema = {
  scripts: [],
  envProfiles: [],
  apiRequests: [],
  apiCollections: [],
  docSources: [],
  userScripts: [],
  selfServiceActions: [],  // ADD
  actionVariables: [],     // ADD
};
```

- [ ] **Step 3: Update the inline fallback inside `readAll()`**

Inside `readAll()`, there is a second literal object returned when the storage key is missing (around lines 26–33). Update it to match:

```ts
if (!result[STORAGE_KEY]) {
  return {
    scripts: [],
    envProfiles: [],
    apiRequests: [],
    apiCollections: [],
    docSources: [],
    userScripts: [],
    selfServiceActions: [],  // ADD
    actionVariables: [],     // ADD
  };
}
```

- [ ] **Step 4: Add CRUD methods for `selfServiceActions`**

Append after the `deleteUserScript` method:

```ts
// --- Self-Service Actions ---

static async getSelfServiceActions(): Promise<SelfServiceAction[]> {
  const data = await StorageService.readAll();
  return data.selfServiceActions;
}

static async saveSelfServiceAction(action: SelfServiceAction): Promise<void> {
  const data = await StorageService.readAll();
  const idx = data.selfServiceActions.findIndex((a) => a.id === action.id);
  if (idx >= 0) {
    data.selfServiceActions[idx] = action;
  } else {
    data.selfServiceActions.push(action);
  }
  await StorageService.writeAll(data);
}

static async deleteSelfServiceAction(id: string): Promise<void> {
  const data = await StorageService.readAll();
  data.selfServiceActions = data.selfServiceActions.filter((a) => a.id !== id);
  await StorageService.writeAll(data);
}

// --- Action Variables ---

static async getActionVariables(): Promise<ActionVariable[]> {
  const data = await StorageService.readAll();
  return data.actionVariables;
}

static async saveActionVariables(variables: ActionVariable[]): Promise<void> {
  const data = await StorageService.readAll();
  data.actionVariables = variables;
  await StorageService.writeAll(data);
}
```

- [ ] **Step 5: Verify TypeScript compiles cleanly**

```bash
cmd.exe /c "cd E:\work\developer-buddy && npx tsc --noEmit"
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/shared/storage/StorageService.ts
git commit -m "feat(actions): extend StorageService with selfServiceActions and actionVariables CRUD"
```

---

### Task 3: StorageService tests for new methods

**Files:**
- Modify: `tests/storage/StorageService.test.ts`

- [ ] **Step 1: Update the existing `exportAll` and `importAll` tests in `tests/storage/StorageService.test.ts`**

The `exportAll` test (around line 99) has a hard-coded key list that must include the two new fields:

```ts
const keys: (keyof StorageSchema)[] = [
  'scripts', 'envProfiles', 'apiRequests', 'apiCollections', 'docSources', 'userScripts',
  'selfServiceActions', 'actionVariables',  // ADD
];
```

The `importAll` test (around line 110) constructs a `StorageSchema` literal that will be a TypeScript error once `StorageSchema` gains the two new required fields. Add them:

```ts
const incoming: StorageSchema = {
  scripts: [makeScript({ id: 'new', name: 'Imported' })],
  envProfiles: [],
  apiRequests: [],
  apiCollections: [],
  docSources: [],
  userScripts: [],
  selfServiceActions: [],  // ADD
  actionVariables: [],     // ADD
};
```

- [ ] **Step 2: Add factory helpers and test suite at the bottom of the test file**

```ts
// ---- helpers ----

function makeAction(overrides: Partial<import('../../src/shared/types').SelfServiceAction> = {}): import('../../src/shared/types').SelfServiceAction {
  return {
    id: 'action-1',
    name: 'Deploy Staging',
    method: 'POST',
    url: 'https://hooks.example.com/deploy',
    headers: [],
    body: '',
    confirmationPrompt: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ---- self-service actions ----

describe('StorageService — SelfServiceActions', () => {
  it('getSelfServiceActions() returns [] on empty storage', async () => {
    const actions = await StorageService.getSelfServiceActions();
    expect(actions).toEqual([]);
  });

  it('saveSelfServiceAction() persists and retrieves an action', async () => {
    const action = makeAction();
    await StorageService.saveSelfServiceAction(action);
    const actions = await StorageService.getSelfServiceActions();
    expect(actions).toHaveLength(1);
    expect(actions[0]).toEqual(action);
  });

  it('saveSelfServiceAction() updates an existing action by id', async () => {
    const action = makeAction();
    await StorageService.saveSelfServiceAction(action);
    await StorageService.saveSelfServiceAction({ ...action, name: 'Updated' });
    const actions = await StorageService.getSelfServiceActions();
    expect(actions).toHaveLength(1);
    expect(actions[0].name).toBe('Updated');
  });

  it('deleteSelfServiceAction() removes by id', async () => {
    await StorageService.saveSelfServiceAction(makeAction({ id: 'a' }));
    await StorageService.saveSelfServiceAction(makeAction({ id: 'b' }));
    await StorageService.deleteSelfServiceAction('a');
    const actions = await StorageService.getSelfServiceActions();
    expect(actions).toHaveLength(1);
    expect(actions[0].id).toBe('b');
  });
});

// ---- action variables ----

describe('StorageService — ActionVariables', () => {
  it('getActionVariables() returns [] on empty storage', async () => {
    const vars = await StorageService.getActionVariables();
    expect(vars).toEqual([]);
  });

  it('saveActionVariables() replaces the full list', async () => {
    const vars = [
      { key: 'API_TOKEN', value: 'tok-1', secret: true },
      { key: 'BASE_URL', value: 'https://example.com', secret: false },
    ];
    await StorageService.saveActionVariables(vars);
    const result = await StorageService.getActionVariables();
    expect(result).toEqual(vars);
  });

  it('saveActionVariables([]) clears all variables', async () => {
    await StorageService.saveActionVariables([{ key: 'K', value: 'V', secret: false }]);
    await StorageService.saveActionVariables([]);
    const result = await StorageService.getActionVariables();
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the new tests**

```bash
cmd.exe /c "cd E:\work\developer-buddy && npx jest tests/storage/StorageService.test.ts --no-coverage"
```

Expected: all tests PASS (including new suites).

- [ ] **Step 3: Commit**

```bash
git add tests/storage/StorageService.test.ts
git commit -m "test(actions): add StorageService tests for selfServiceActions and actionVariables"
```

---

## Chunk 2: Settings UI — ActionsManager

### Task 4: Build `ActionsManager` settings component

**Files:**
- Create: `src/options/modules/actions/ActionsManager.tsx`

This is a single file that renders the full Actions settings page. It has three internal states:
- `'list'` — shows Action Variables table + Actions list
- `'new'` — shows the action editor with empty fields
- `'edit'` — shows the action editor pre-filled with an existing action

- [ ] **Step 1: Create the file**

```tsx
// src/options/modules/actions/ActionsManager.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';
import { StorageService } from '../../../shared/storage/StorageService';
import type { ActionVariable, SelfServiceAction } from '../../../shared/types';
import { generateId } from '../../../shared/utils/id';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PageState = 'list' | 'new' | 'edit';
type HttpMethod = SelfServiceAction['method'];

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET:    'bg-blue-500/10 text-blue-500 border-blue-500/30',
  POST:   'bg-green-500/10 text-green-500 border-green-500/30',
  PUT:    'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
  PATCH:  'bg-orange-500/10 text-orange-500 border-orange-500/30',
  DELETE: 'bg-red-500/10 text-red-500 border-red-500/30',
};

// ---------------------------------------------------------------------------
// Variables Table
// ---------------------------------------------------------------------------

function VariablesTable({
  variables,
  onChange,
}: {
  variables: ActionVariable[];
  onChange: (vars: ActionVariable[]) => void;
}) {
  const [revealed, setRevealed] = useState<Set<number>>(new Set());

  const add = () =>
    onChange([...variables, { key: '', value: '', secret: false }]);

  const update = (i: number, patch: Partial<ActionVariable>) => {
    const next = variables.map((v, idx) => (idx === i ? { ...v, ...patch } : v));
    onChange(next);
  };

  const remove = (i: number) => onChange(variables.filter((_, idx) => idx !== i));

  const toggleReveal = (i: number) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Action Variables</h3>
          <p className="text-xs text-text-muted mt-0.5">
            Shared variables available in all actions via{' '}
            <code className="px-1 py-0.5 bg-accent-container rounded text-accent text-[11px]">
              {'{{VAR_NAME}}'}
            </code>
          </p>
        </div>
        <button
          onClick={add}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent text-[var(--color-bg-primary)] rounded-lg text-xs font-medium hover:opacity-90 transition-colors shrink-0"
        >
          <Plus size={12} /> Add Variable
        </button>
      </div>

      {variables.length === 0 ? (
        <div className="text-center py-6 text-text-muted text-xs border border-dashed border-theme-border rounded-card">
          No variables yet. Add one to use in action URLs or headers.
        </div>
      ) : (
        <div className="border border-theme-border rounded-card overflow-hidden">
          <div className="grid grid-cols-[1fr_1fr_60px_28px_28px] gap-0 bg-surface border-b border-theme-border px-3 py-2 text-[10px] font-semibold text-text-muted uppercase tracking-wide">
            <div>Key</div>
            <div>Value</div>
            <div>Secret</div>
            <div />
            <div />
          </div>
          {variables.map((v, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_1fr_60px_28px_28px] gap-0 border-b border-theme-border last:border-0 px-3 py-1.5 items-center bg-[var(--color-bg-primary)]"
            >
              <input
                value={v.key}
                onChange={(e) => update(i, { key: e.target.value })}
                placeholder="VAR_NAME"
                className="font-mono text-xs text-text-primary bg-transparent border-0 outline-none w-full pr-2 placeholder:text-text-muted"
              />
              <div className="flex items-center gap-1 pr-2">
                <input
                  type={v.secret && !revealed.has(i) ? 'password' : 'text'}
                  value={v.value}
                  onChange={(e) => update(i, { value: e.target.value })}
                  placeholder="value"
                  className="font-mono text-xs text-text-primary bg-transparent border-0 outline-none w-full placeholder:text-text-muted"
                />
              </div>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={v.secret}
                  onChange={(e) => update(i, { secret: e.target.checked })}
                  className="w-3 h-3"
                />
                <span className="text-[10px] text-text-muted">{v.secret ? 'Yes' : 'No'}</span>
              </label>
              <button
                onClick={() => toggleReveal(i)}
                title={revealed.has(i) ? 'Hide' : 'Reveal'}
                className="p-1 text-text-muted hover:text-text-primary transition-colors"
              >
                {revealed.has(i) ? <EyeOff size={12} /> : <Eye size={12} />}
              </button>
              <button
                onClick={() => remove(i)}
                className="p-1 text-text-muted hover:text-red-400 transition-colors"
                title="Remove"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Action Editor
// ---------------------------------------------------------------------------

interface HeaderRow {
  key: string;
  value: string;
  enabled: boolean;
}

function emptyAction(): Omit<SelfServiceAction, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name: '',
    method: 'POST',
    url: '',
    headers: [],
    body: '',
    confirmationPrompt: '',
  };
}

function ActionEditor({
  action,
  onSave,
  onCancel,
}: {
  action: SelfServiceAction | null; // null = new
  onSave: (a: SelfServiceAction) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(action?.name ?? '');
  const [method, setMethod] = useState<HttpMethod>(action?.method ?? 'POST');
  const [url, setUrl] = useState(action?.url ?? '');
  const [headers, setHeaders] = useState<HeaderRow[]>(action?.headers ?? []);
  const [body, setBody] = useState(action?.body ?? '');
  const [confirmationPrompt, setConfirmationPrompt] = useState(action?.confirmationPrompt ?? '');
  const [errors, setErrors] = useState<{ name?: string; url?: string }>({});

  const addHeader = () =>
    setHeaders((h) => [...h, { key: '', value: '', enabled: true }]);

  const updateHeader = (i: number, patch: Partial<HeaderRow>) =>
    setHeaders((h) => h.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const removeHeader = (i: number) =>
    setHeaders((h) => h.filter((_, idx) => idx !== i));

  const handleSave = () => {
    const errs: { name?: string; url?: string } = {};
    if (!name.trim()) errs.name = 'Name is required.';
    if (!url.trim()) errs.url = 'URL is required.';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    const now = new Date().toISOString();
    const saved: SelfServiceAction = {
      id: action?.id ?? generateId(),
      name: name.trim(),
      method,
      url: url.trim(),
      headers,
      body: ['POST', 'PUT', 'PATCH'].includes(method) ? body : '',
      confirmationPrompt: confirmationPrompt.trim(),
      createdAt: action?.createdAt ?? now,
      updatedAt: now,
    };
    onSave(saved);
  };

  const showBody = ['POST', 'PUT', 'PATCH'].includes(method);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-text-primary">
          {action ? 'Edit Action' : 'New Action'}
        </h2>
      </div>

      {/* Name */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-text-secondary">Name</label>
        <input
          value={name}
          onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: undefined })); }}
          placeholder="Deploy to Staging"
          className="w-full px-3 py-2 text-sm border border-theme-border rounded-card bg-[var(--color-bg-primary)] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
        />
        {errors.name && <p className="text-xs text-red-400">{errors.name}</p>}
      </div>

      {/* Method + URL */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-text-secondary">Method & URL</label>
        <div className="flex gap-2">
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as HttpMethod)}
            className="w-28 px-2 py-2 text-xs font-mono font-semibold border border-theme-border rounded-card bg-[var(--color-bg-primary)] text-text-primary focus:outline-none focus:border-accent"
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <input
            value={url}
            onChange={(e) => { setUrl(e.target.value); setErrors((p) => ({ ...p, url: undefined })); }}
            placeholder="https://hooks.example.com/deploy or {{HOOK_URL}}"
            className="flex-1 px-3 py-2 text-xs font-mono border border-theme-border rounded-card bg-[var(--color-bg-primary)] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
        </div>
        {errors.url && <p className="text-xs text-red-400">{errors.url}</p>}
      </div>

      {/* Headers */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-text-secondary">Headers</label>
          <button
            onClick={addHeader}
            className="text-xs text-accent hover:underline"
          >
            + Add
          </button>
        </div>
        {headers.length > 0 && (
          <div className="border border-theme-border rounded-card overflow-hidden">
            <div className="grid grid-cols-[24px_1fr_1fr_24px] gap-0 bg-surface border-b border-theme-border px-2 py-1.5 text-[10px] font-semibold text-text-muted uppercase tracking-wide">
              <div />
              <div>Key</div>
              <div>Value</div>
              <div />
            </div>
            {headers.map((h, i) => (
              <div key={i} className="grid grid-cols-[24px_1fr_1fr_24px] gap-0 border-b border-theme-border last:border-0 px-2 py-1.5 items-center bg-[var(--color-bg-primary)]">
                <input
                  type="checkbox"
                  checked={h.enabled}
                  onChange={(e) => updateHeader(i, { enabled: e.target.checked })}
                  className="w-3 h-3"
                />
                <input
                  value={h.key}
                  onChange={(e) => updateHeader(i, { key: e.target.value })}
                  placeholder="Authorization"
                  className="font-mono text-xs text-text-primary bg-transparent border-0 outline-none w-full px-1 placeholder:text-text-muted"
                />
                <input
                  value={h.value}
                  onChange={(e) => updateHeader(i, { value: e.target.value })}
                  placeholder="Bearer {{API_TOKEN}}"
                  className="font-mono text-xs text-text-primary bg-transparent border-0 outline-none w-full px-1 placeholder:text-text-muted"
                />
                <button onClick={() => removeHeader(i)} className="p-1 text-text-muted hover:text-red-400 transition-colors">
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      {showBody && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-text-secondary">
            Body <span className="font-normal text-text-muted">(optional, JSON)</span>
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder='{ "key": "value" }'
            rows={4}
            className="w-full px-3 py-2 text-xs font-mono border border-theme-border rounded-card bg-[var(--color-bg-primary)] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-y"
          />
        </div>
      )}

      {/* Confirmation prompt */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-text-secondary">
          Confirmation prompt{' '}
          <span className="font-normal text-text-muted">(leave blank — action fires immediately)</span>
        </label>
        <input
          value={confirmationPrompt}
          onChange={(e) => setConfirmationPrompt(e.target.value)}
          placeholder="Are you sure you want to deploy to staging?"
          className="w-full px-3 py-2 text-sm border border-theme-border rounded-card bg-[var(--color-bg-primary)] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
        />
      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary border border-theme-border rounded-card transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-2 text-sm bg-accent text-[var(--color-bg-primary)] rounded-card font-medium hover:opacity-90 transition-colors"
        >
          Save Action
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function ActionsManager() {
  const [pageState, setPageState] = useState<PageState>('list');
  const [editingAction, setEditingAction] = useState<SelfServiceAction | null>(null);
  const [actions, setActions] = useState<SelfServiceAction[]>([]);
  const [variables, setVariables] = useState<ActionVariable[]>([]);
  const [varsDirty, setVarsDirty] = useState(false);

  const load = useCallback(async () => {
    const [acts, vars] = await Promise.all([
      StorageService.getSelfServiceActions(),
      StorageService.getActionVariables(),
    ]);
    setActions(acts);
    setVariables(vars);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleVarsChange = (vars: ActionVariable[]) => {
    setVariables(vars);
    setVarsDirty(true);
  };

  const handleSaveVars = async () => {
    await StorageService.saveActionVariables(variables);
    setVarsDirty(false);
  };

  const handleSaveAction = async (action: SelfServiceAction) => {
    await StorageService.saveSelfServiceAction(action);
    setPageState('list');
    setEditingAction(null);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this action?')) return;
    await StorageService.deleteSelfServiceAction(id);
    load();
  };

  // Show editor when creating or editing
  if (pageState === 'new' || pageState === 'edit') {
    return (
      <ActionEditor
        action={editingAction}
        onSave={handleSaveAction}
        onCancel={() => { setPageState('list'); setEditingAction(null); }}
      />
    );
  }

  return (
    <div className="space-y-8">
      {/* Section 1: Variables */}
      <div>
        <VariablesTable variables={variables} onChange={handleVarsChange} />
        {varsDirty && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={handleSaveVars}
              className="px-4 py-2 text-sm bg-accent text-[var(--color-bg-primary)] rounded-card font-medium hover:opacity-90 transition-colors"
            >
              Save Variables
            </button>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-theme-border" />

      {/* Section 2: Actions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">Actions</h3>
          <button
            onClick={() => { setEditingAction(null); setPageState('new'); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent text-[var(--color-bg-primary)] rounded-lg text-xs font-medium hover:opacity-90 transition-colors"
          >
            <Plus size={12} /> New Action
          </button>
        </div>

        {actions.length === 0 ? (
          <div className="text-center py-12 text-text-muted">
            <p className="text-sm">No actions yet.</p>
            <p className="text-xs mt-1">Create an action to trigger it from the side panel.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {actions.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between px-4 py-3 rounded-card border border-theme-border bg-surface"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`shrink-0 text-[10px] font-bold font-mono px-1.5 py-0.5 rounded border ${METHOD_COLORS[a.method]}`}>
                    {a.method}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-text-primary">{a.name}</div>
                    <div className="text-xs text-text-muted font-mono truncate max-w-xs">{a.url}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <button
                    onClick={() => { setEditingAction(a); setPageState('edit'); }}
                    className="p-1.5 text-text-muted hover:text-text-primary hover:bg-accent-container rounded transition-colors"
                    title="Edit"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(a.id)}
                    className="p-1.5 text-text-muted hover:text-red-400 hover:bg-accent-container rounded transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
cmd.exe /c "cd E:\work\developer-buddy && npx tsc --noEmit"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/options/modules/actions/ActionsManager.tsx
git commit -m "feat(actions): add ActionsManager settings component"
```

---

### Task 5: Wire Actions into the options page

**Files:**
- Modify: `src/options/App.tsx`

- [ ] **Step 1: Add import and nav entry**

At the top of `src/options/App.tsx`, add the import:

```ts
import { ActionsManager } from './modules/actions/ActionsManager';
```

Update the `Section` type:

```ts
type Section = 'env' | 'user-scripts' | 'docs' | 'actions' | 'import-export' | 'about';
```

Update the `NAV` array — insert `actions` between `docs` and `import-export`:

```ts
const NAV: { id: Section; label: string }[] = [
  { id: 'env',           label: 'Environment Profiles' },
  { id: 'user-scripts',  label: 'User Scripts' },
  { id: 'docs',          label: 'Documentation' },
  { id: 'actions',       label: 'Actions' },
  { id: 'import-export', label: 'Import / Export' },
  { id: 'about',         label: 'About' },
];
```

- [ ] **Step 2: Render `ActionsManager` in the content area**

In the JSX content section, add alongside the other sections:

```tsx
{activeSection === 'actions' && <ActionsManager />}
```

- [ ] **Step 3: Build and verify**

```bash
cmd.exe /c "cd E:\work\developer-buddy && npm run build"
```

Expected: Build succeeds with zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/options/App.tsx
git commit -m "feat(actions): add Actions nav section to options page"
```

---

## Chunk 3: Side Panel — ActionsPanel

### Task 6: Build `ActionsPanel` side panel component

**Files:**
- Create: `src/side-panel/modules/actions/ActionsPanel.tsx`

- [ ] **Step 1: Create the file**

```tsx
// src/side-panel/modules/actions/ActionsPanel.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Play, AlertCircle, CheckCircle2 } from 'lucide-react';
import { StorageService } from '../../../shared/storage/StorageService';
import type { SelfServiceAction, ActionVariable, EnvProfile } from '../../../shared/types';
import { interpolate } from '../../../shared/utils/interpolate';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const METHOD_COLORS: Record<SelfServiceAction['method'], string> = {
  GET:    'bg-blue-500/10 text-blue-500 border-blue-500/30',
  POST:   'bg-green-500/10 text-green-500 border-green-500/30',
  PUT:    'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
  PATCH:  'bg-orange-500/10 text-orange-500 border-orange-500/30',
  DELETE: 'bg-red-500/10 text-red-500 border-red-500/30',
};

function buildProfile(variables: ActionVariable[]): EnvProfile {
  return { id: '', name: 'action-variables', isActive: true, variables };
}

function statusColor(status: number): string {
  if (status >= 200 && status < 300) return 'text-green-500';
  if (status >= 400) return 'text-red-400';
  return 'text-yellow-500';
}

// ---------------------------------------------------------------------------
// Action result type
// ---------------------------------------------------------------------------

type ActionResult =
  | { state: 'success'; status: number; statusText: string; body: string; durationMs: number }
  | { state: 'error'; message: string };

// ---------------------------------------------------------------------------
// Single action card
// ---------------------------------------------------------------------------

function ActionCard({
  action,
  variables,
}: {
  action: SelfServiceAction;
  variables: ActionVariable[];
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  const fire = useCallback(async () => {
    setConfirmOpen(false);
    setRunning(true);
    setResult(null);
    const profile = buildProfile(variables);
    const url = interpolate(action.url, profile);
    const enabledHeaders = action.headers.filter((h) => h.enabled && h.key.trim());
    const headersInit: Record<string, string> = {};
    for (const h of enabledHeaders) {
      headersInit[interpolate(h.key, profile)] = interpolate(h.value, profile);
    }
    const hasBody = ['POST', 'PUT', 'PATCH'].includes(action.method) && action.body.trim();
    const bodyInit = hasBody ? interpolate(action.body, profile) : undefined;
    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(url, {
        method: action.method,
        headers: headersInit,
        signal: controller.signal,
        ...(bodyInit ? { body: bodyInit } : {}),
      });
      const raw = await res.text();
      const truncated = raw.length > 300 ? raw.slice(0, 300) + '…' : raw;
      setResult({
        state: 'success',
        status: res.status,
        statusText: res.statusText,
        body: truncated,
        durationMs: Date.now() - start,
      });
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === 'AbortError';
      setResult({
        state: 'error',
        message: isTimeout ? 'Request timed out after 10s' : (err instanceof Error ? err.message : 'Request failed'),
      });
    } finally {
      clearTimeout(timeoutId);
      setRunning(false);
    }
  }, [action, variables]);

  const handleClick = () => {
    if (running) return;
    setResult(null);
    if (action.confirmationPrompt) {
      setConfirmOpen(true);
    } else {
      fire();
    }
  };

  return (
    <div className={`border rounded-card overflow-hidden bg-surface transition-colors ${
      confirmOpen ? 'border-accent' : 'border-theme-border'
    }`}>
      {/* Trigger button */}
      <button
        onClick={handleClick}
        disabled={running}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-accent-container transition-colors disabled:opacity-60 text-left"
      >
        {running ? (
          <Loader2 size={12} className="animate-spin text-text-muted shrink-0" />
        ) : (
          <span className={`shrink-0 text-[9px] font-bold font-mono px-1.5 py-0.5 rounded border ${METHOD_COLORS[action.method]}`}>
            {action.method}
          </span>
        )}
        <span className="text-xs font-semibold text-text-primary">{action.name}</span>
      </button>

      {/* Confirmation inline */}
      {confirmOpen && !running && (
        <div className="px-3 pb-3 pt-1 border-t border-theme-border space-y-2">
          <p className="text-xs text-text-secondary">{action.confirmationPrompt}</p>
          <div className="flex gap-2">
            <button
              onClick={fire}
              className="flex-1 px-3 py-1.5 bg-red-500 text-white rounded-card text-xs font-semibold hover:bg-red-600 transition-colors"
            >
              Confirm
            </button>
            <button
              onClick={() => setConfirmOpen(false)}
              className="flex-1 px-3 py-1.5 border border-theme-border rounded-card text-xs text-text-secondary hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Result */}
      {result && !confirmOpen && (
        <div className="px-3 pb-3 pt-1 border-t border-theme-border space-y-1.5">
          {result.state === 'success' && (
            <>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={11} className="text-green-500 shrink-0" />
                <span className={`text-xs font-bold ${statusColor(result.status)}`}>
                  {result.status} {result.statusText}
                </span>
                <span className="text-[10px] text-text-muted">{result.durationMs}ms</span>
              </div>
              {result.body && (
                <pre className="text-[10px] font-mono text-text-secondary bg-[var(--color-bg-primary)] border border-theme-border rounded p-2 whitespace-pre-wrap break-all leading-relaxed max-h-24 overflow-auto">
                  {result.body}
                </pre>
              )}
            </>
          )}
          {result.state === 'error' && (
            <div className="flex items-start gap-1.5 text-xs text-red-400">
              <AlertCircle size={11} className="shrink-0 mt-0.5" />
              <span>{result.message}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function ActionsPanel() {
  const [actions, setActions] = useState<SelfServiceAction[]>([]);
  const [variables, setVariables] = useState<ActionVariable[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      StorageService.getSelfServiceActions(),
      StorageService.getActionVariables(),
    ]).then(([acts, vars]) => {
      setActions(acts);
      setVariables(vars);
      setLoaded(true);
    });
  }, []);

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-12 text-text-muted">
        <Loader2 size={18} className="animate-spin" />
      </div>
    );
  }

  if (actions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2 text-text-muted">
        <Play size={24} className="opacity-40" />
        <p className="text-xs">No actions defined.</p>
        <p className="text-xs">Go to Settings → Actions to create one.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {actions.map((action) => (
        <ActionCard key={action.id} action={action} variables={variables} />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
cmd.exe /c "cd E:\work\developer-buddy && npx tsc --noEmit"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/side-panel/modules/actions/ActionsPanel.tsx
git commit -m "feat(actions): add ActionsPanel side panel component"
```

---

### Task 7: Wire Actions tab into the side panel

**Files:**
- Modify: `src/side-panel/App.tsx`

- [ ] **Step 1: Add import**

At the top of `src/side-panel/App.tsx`, add:

```ts
import { ActionsPanel } from './modules/actions/ActionsPanel';
```

Also add `Play` to the existing lucide-react import line (`Zap` is already used by the API Tester entry and must not be reused):

```ts
import { Terminal, Zap, BookOpen, GitPullRequest, Code, Settings, ArrowLeft, SunMoon, Play } from 'lucide-react';
```

- [ ] **Step 2: Add `'actions'` to the `Module` type**

```ts
type Module = 'scripts' | 'api' | 'docs' | 'pr' | 'user-scripts' | 'actions';
```

- [ ] **Step 3: Add to `MODULES` array**

Add `actions` after `pr` in the `MODULES` array using the `Play` icon:

```ts
{ id: 'actions', label: 'Actions', Icon: Play },
```

- [ ] **Step 4: Render `ActionsPanel` in the module content area**

In the `renderedModule` switch block inside the module panel `div`, add:

```tsx
{renderedModule === 'actions' && <ActionsPanel />}
```

- [ ] **Step 5: Full build**

```bash
cmd.exe /c "cd E:\work\developer-buddy && npm run build"
```

Expected: Build succeeds with zero errors.

- [ ] **Step 6: Run all tests**

```bash
cmd.exe /c "cd E:\work\developer-buddy && npx jest --no-coverage"
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/side-panel/App.tsx
git commit -m "feat(actions): add Actions tab to side panel"
```

---

## Done

All three chunks complete. The feature is fully implemented:

- `Settings → Actions` — define action variables + action CRUD with inline editor
- `Side panel → Actions tab` — trigger buttons, optional confirmation, inline status + truncated response
- All new storage methods covered by tests
- Full build passing with zero errors
