import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Pin, Check, X } from 'lucide-react';
import { StorageService } from '../../../shared/storage/StorageService';
import type { DocSource } from '../../../shared/types';
import { generateId } from '../../../shared/utils/id';

interface FormState {
  name: string;
  url: string;
  isPinned: boolean;
}

const EMPTY_FORM: FormState = { name: '', url: '', isPinned: false };

export function DocsManager() {
  const [sources, setSources] = useState<DocSource[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    const all = await StorageService.getDocSources();
    setSources(all);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const validate = (): boolean => {
    if (!form.name.trim()) { setError('Name is required.'); return false; }
    if (!form.url.startsWith('https://')) {
      setError('URL must start with https://');
      return false;
    }
    setError('');
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    const source: DocSource = {
      id: editingId ?? generateId(),
      name: form.name.trim(),
      url: form.url.trim(),
      isPinned: form.isPinned,
    };
    await StorageService.saveDocSource(source);
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
    load();
  };

  const startEdit = (s: DocSource) => {
    setForm({ name: s.name, url: s.url, isPinned: s.isPinned });
    setEditingId(s.id);
    setShowForm(true);
    setError('');
  };

  const cancelEdit = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
    setError('');
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this documentation source?')) return;
    await StorageService.deleteDocSource(id);
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-text-primary">Documentation Sources</h2>
        {!showForm && (
          <button
            onClick={() => { setForm(EMPTY_FORM); setEditingId(null); setShowForm(true); setError(''); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-accent text-[var(--color-bg-primary)] rounded-lg text-sm font-medium hover:opacity-90 transition-colors"
          >
            <Plus size={14} />
            Add Source
          </button>
        )}
      </div>

      {showForm && (
        <div className="border border-theme-border rounded-card p-4 bg-[var(--color-bg-primary)] space-y-3">
          <h3 className="text-sm font-semibold text-text-secondary">
            {editingId ? 'Edit Source' : 'New Source'}
          </h3>
          <div className="space-y-2">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); setError(''); }}
                placeholder="MDN Web Docs"
                className="w-full max-w-sm border border-theme-border rounded-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">URL (https://)</label>
              <input
                type="url"
                value={form.url}
                onChange={(e) => { setForm((f) => ({ ...f, url: e.target.value })); setError(''); }}
                placeholder="https://developer.mozilla.org"
                className="w-full max-w-sm border border-theme-border rounded-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.isPinned}
                onChange={(e) => setForm((f) => ({ ...f, isPinned: e.target.checked }))}
                className="accent-[var(--color-accent)]"
              />
              <Pin size={13} className="text-accent" />
              Pin this source
            </label>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="inline-flex items-center gap-1 px-3 py-2 bg-accent text-[var(--color-bg-primary)] rounded-lg text-sm font-medium hover:opacity-90 transition-colors"
            >
              <Check size={13} /> Save
            </button>
            <button
              onClick={cancelEdit}
              className="inline-flex items-center gap-1 px-3 py-2 bg-accent-container text-text-secondary rounded-lg text-sm font-medium hover:bg-accent-container transition-colors"
            >
              <X size={13} /> Cancel
            </button>
          </div>
        </div>
      )}

      {sources.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-8">
          No documentation sources yet.
        </p>
      ) : (
        <div className="space-y-2">
          {sources
            .sort((a, b) => {
              if (a.isPinned && !b.isPinned) return -1;
              if (!a.isPinned && b.isPinned) return 1;
              return a.name.localeCompare(b.name);
            })
            .map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 px-4 py-3 border border-theme-border rounded-card bg-surface"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-text-primary">{s.name}</span>
                    {s.isPinned && (
                      <Pin size={12} className="text-accent shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-text-muted truncate mt-0.5">{s.url}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => startEdit(s)}
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
