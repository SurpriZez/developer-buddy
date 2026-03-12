import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { StorageService } from '../../../shared/storage/StorageService';
import type { EnvProfile } from '../../../shared/types';
import { EnvProfileEditor } from './EnvProfileEditor';

export function EnvManager() {
  const [profiles, setProfiles] = useState<EnvProfile[]>([]);
  const [editing, setEditing] = useState<EnvProfile | null | 'new'>(null);

  const load = useCallback(async () => {
    const all = await StorageService.getEnvProfiles();
    setProfiles(all);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSetActive = async (id: string) => {
    await StorageService.setActiveProfile(id);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this profile?')) return;
    await StorageService.deleteEnvProfile(id);
    load();
  };

  const handleSave = async (profile: EnvProfile) => {
    await StorageService.saveEnvProfile(profile);
    setEditing(null);
    load();
  };

  if (editing !== null) {
    return (
      <EnvProfileEditor
        profile={editing === 'new' ? null : editing}
        onSave={handleSave}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-text-primary">Environment Profiles</h2>
        <button
          onClick={() => setEditing('new')}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-accent text-[var(--color-bg-primary)] rounded-lg text-sm font-medium hover:opacity-90 transition-colors"
        >
          <Plus size={14} />
          New Profile
        </button>
      </div>

      {profiles.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          <p className="text-sm">No profiles yet.</p>
          <p className="text-xs mt-1">Create a profile to manage environment variables.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {profiles.map((p) => (
            <div
              key={p.id}
              className={`flex items-center justify-between px-4 py-3 rounded-card border ${
                p.isActive
                  ? 'border-accent bg-accent-container'
                  : 'border-theme-border bg-surface'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    p.isActive ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                />
                <div className="min-w-0">
                  <span className="font-medium text-sm text-text-primary">{p.name}</span>
                  <span className="ml-2 text-xs text-text-muted">
                    {p.variables.length} variable{p.variables.length !== 1 ? 's' : ''}
                  </span>
                  {p.isActive && (
                    <span className="ml-2 text-xs font-medium text-accent bg-accent-container px-1.5 py-0.5 rounded-full">
                      Active
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0 ml-2">
                {!p.isActive && (
                  <button
                    onClick={() => handleSetActive(p.id)}
                    className="px-2.5 py-1 text-xs font-medium text-accent border border-accent rounded hover:bg-accent-container transition-colors"
                  >
                    Set Active
                  </button>
                )}
                <button
                  onClick={() => setEditing(p)}
                  className="p-1.5 text-text-muted hover:text-text-primary hover:bg-accent-container rounded transition-colors"
                  title="Edit"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDelete(p.id)}
                  disabled={p.isActive}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title={p.isActive ? 'Cannot delete active profile' : 'Delete'}
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
