import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { StorageService } from '../../../shared/storage/StorageService';
import { syncUserScriptRegistrations } from '../../../shared/utils/userScriptRegistrar';
import type { UserScript } from '../../../shared/types';
import { UserScriptEditor } from './UserScriptEditor';

export function UserScriptList() {
  const [scripts, setScripts] = useState<UserScript[]>([]);
  const [editing, setEditing] = useState<UserScript | null | 'new'>(null);

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
        onSave={handleSave}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">User Scripts</h2>
        <button
          onClick={() => setEditing('new')}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          <Plus size={14} />
          New Script
        </button>
      </div>

      {scripts.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-sm">No user scripts yet.</p>
          <p className="text-xs mt-1">Create a script to automate actions on matching pages.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {scripts.map((s) => (
            <div
              key={s.id}
              className={`flex items-start gap-3 px-4 py-3 rounded-lg border ${
                s.enabled ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'
              }`}
            >
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-gray-900">{s.name}</span>
                  <span className="text-xs text-gray-400 font-mono">v{s.version}</span>
                </div>
                {s.description && (
                  <p className="text-xs text-gray-500">{s.description}</p>
                )}
                <div className="flex flex-wrap gap-1">
                  {s.matchPatterns.map((p) => (
                    <span
                      key={p}
                      className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-xs font-mono"
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
                        className="bg-brand-50 text-brand-600 px-1.5 py-0.5 rounded text-xs font-mono"
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
                    s.enabled ? 'text-brand-500 hover:text-brand-700' : 'text-gray-300 hover:text-gray-500'
                  }`}
                  title={s.enabled ? 'Disable' : 'Enable'}
                >
                  {s.enabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                </button>
                <button
                  onClick={() => setEditing(s)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                  title="Edit"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDelete(s.id)}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
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
