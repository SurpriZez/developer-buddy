import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, LayoutTemplate } from 'lucide-react';
import { StorageService } from '../../../shared/storage/StorageService';
import { syncUserScriptRegistrations } from '../../../shared/utils/userScriptRegistrar';
import type { UserScript } from '../../../shared/types';
import { UserScriptEditor } from './UserScriptEditor';
import { TemplateGallery } from './TemplateGallery';

export function UserScriptList() {
  const [scripts, setScripts] = useState<UserScript[]>([]);
  const [editing, setEditing] = useState<UserScript | null | 'new'>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateBody, setTemplateBody] = useState<string | undefined>(undefined);

  const load = useCallback(async () => {
    const all = await StorageService.getUserScripts();
    setScripts(all);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (script: UserScript) => {
    await StorageService.saveUserScript(script);
    await syncUserScriptRegistrations();
    setEditing(null);
    setTemplateBody(undefined);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this user script?')) return;
    await StorageService.deleteUserScript(id);
    await syncUserScriptRegistrations();
    load();
  };

  const handleToggle = async (script: UserScript) => {
    await StorageService.saveUserScript({ ...script, enabled: !script.enabled });
    await syncUserScriptRegistrations();
    load();
  };

  if (editing !== null) {
    return (
      <UserScriptEditor
        script={editing === 'new' ? null : editing}
        initialBody={editing === 'new' ? templateBody : undefined}
        onSave={handleSave}
        onCancel={() => { setEditing(null); setTemplateBody(undefined); }}
      />
    );
  }

  if (showTemplates) {
    return (
      <TemplateGallery
        onUse={(body) => { setTemplateBody(body); setShowTemplates(false); setEditing('new'); }}
        onCancel={() => setShowTemplates(false)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-text-primary">User Scripts</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTemplates(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-theme-border text-text-secondary rounded-card text-sm font-medium hover:bg-accent-container transition-colors"
          >
            <LayoutTemplate size={14} />
            Templates
          </button>
          <button
            onClick={() => setEditing('new')}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-accent text-[var(--color-bg-primary)] rounded-card text-sm font-medium hover:opacity-90 transition-colors"
          >
            <Plus size={14} />
            New Script
          </button>
        </div>
      </div>

      {scripts.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          <p className="text-sm">No user scripts yet.</p>
          <p className="text-xs mt-1">Create a script to automate actions on matching pages.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {scripts.map((s) => (
            <div
              key={s.id}
              className={`flex items-start gap-3 px-4 py-3 rounded-card border ${
                s.enabled ? 'border-theme-border bg-surface' : 'border-theme-border bg-[var(--color-bg-primary)] opacity-60'
              }`}
            >
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-text-primary">{s.name}</span>
                  <span className="text-xs text-text-muted font-mono">v{s.version}</span>
                </div>
                {s.description && (
                  <p className="text-xs text-text-muted">{s.description}</p>
                )}
                <div className="flex flex-wrap gap-1">
                  {s.matchPatterns.map((p) => (
                    <span
                      key={p}
                      className="bg-accent-container text-text-secondary px-1.5 py-0.5 rounded text-xs font-mono"
                    >
                      {p}
                    </span>
                  ))}
                </div>
                {s.grants.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {s.grants.map((g) => (
                      <span
                        key={g}
                        className="bg-accent-container text-accent px-1.5 py-0.5 rounded text-xs font-mono"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0 mt-0.5">
                <button
                  onClick={() => handleToggle(s)}
                  className={`transition-colors ${
                    s.enabled ? 'text-accent hover:opacity-90' : 'text-text-muted hover:text-text-secondary'
                  }`}
                  title={s.enabled ? 'Disable' : 'Enable'}
                >
                  {s.enabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                </button>
                <button
                  onClick={() => setEditing(s)}
                  className="p-1.5 text-text-muted hover:text-text-primary hover:bg-accent-container rounded transition-colors"
                  title="Edit"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDelete(s.id)}
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
  );
}
