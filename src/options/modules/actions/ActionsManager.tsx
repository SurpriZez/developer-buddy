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

  const remove = (i: number) => {
    setRevealed(new Set());
    onChange(variables.filter((_, idx) => idx !== i));
  };

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
