import React, { useState } from 'react';
import { Eye, EyeOff, Trash2, Plus } from 'lucide-react';
import type { EnvProfile, EnvVariable } from '../../../shared/types';
import { generateId } from '../../../shared/utils/id';

interface Props {
  profile: EnvProfile | null; // null = new profile
  onSave: (profile: EnvProfile) => void;
  onCancel: () => void;
}

export function EnvProfileEditor({ profile, onSave, onCancel }: Props) {
  const [name, setName] = useState(profile?.name ?? '');
  const [variables, setVariables] = useState<EnvVariable[]>(
    profile?.variables ?? []
  );
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [error, setError] = useState('');

  const addVariable = () => {
    setVariables((v) => [...v, { key: '', value: '', secret: false }]);
  };

  const updateVariable = (
    index: number,
    field: keyof EnvVariable,
    value: string | boolean
  ) => {
    setVariables((vars) =>
      vars.map((v, i) => (i === index ? { ...v, [field]: value } : v))
    );
  };

  const deleteVariable = (index: number) => {
    setVariables((vars) => vars.filter((_, i) => i !== index));
    setRevealed((r) => {
      const next = { ...r };
      delete next[index];
      return next;
    });
  };

  const toggleReveal = (index: number) => {
    setRevealed((r) => ({ ...r, [index]: !r[index] }));
  };

  const handleSave = () => {
    if (!name.trim()) {
      setError('Profile name is required.');
      return;
    }
    const saved: EnvProfile = {
      id: profile?.id ?? generateId(),
      name: name.trim(),
      isActive: profile?.isActive ?? false,
      variables: variables.filter((v) => v.key.trim() !== ''),
    };
    onSave(saved);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-text-primary mb-4">
          {profile ? 'Edit Profile' : 'New Profile'}
        </h2>

        <label className="block text-xs font-medium text-text-secondary mb-1">
          Profile Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setError(''); }}
          placeholder="e.g. Production"
          className="w-full max-w-sm border border-theme-border rounded-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        />
        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
            Variables
          </h3>
          <button
            onClick={addVariable}
            className="inline-flex items-center gap-1 text-xs text-accent hover:opacity-90 font-medium"
          >
            <Plus size={14} />
            Add Variable
          </button>
        </div>

        {variables.length === 0 ? (
          <p className="text-sm text-text-muted py-4 text-center">
            No variables. Click "Add Variable" to get started.
          </p>
        ) : (
          <div className="border border-theme-border rounded-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-bg-primary)] text-xs text-text-muted uppercase tracking-wide">
                  <th className="text-left px-3 py-2 font-medium w-2/5">Key</th>
                  <th className="text-left px-3 py-2 font-medium w-2/5">Value</th>
                  <th className="text-center px-3 py-2 font-medium w-16">Secret</th>
                  <th className="px-3 py-2 w-10" />
                </tr>
              </thead>
              <tbody>
                {variables.map((v, i) => (
                  <tr key={i} className="border-t border-theme-border">
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={v.key}
                        onChange={(e) => updateVariable(i, 'key', e.target.value)}
                        placeholder="KEY_NAME"
                        className="w-full border border-theme-border rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="relative flex items-center">
                        <input
                          type={v.secret && !revealed[i] ? 'password' : 'text'}
                          value={v.value}
                          onChange={(e) => updateVariable(i, 'value', e.target.value)}
                          placeholder="value"
                          className="w-full border border-theme-border rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-accent pr-7"
                        />
                        {v.secret && (
                          <button
                            type="button"
                            onClick={() => toggleReveal(i)}
                            className="absolute right-1.5 text-text-muted hover:text-text-secondary"
                            title={revealed[i] ? 'Hide' : 'Reveal'}
                          >
                            {revealed[i] ? <EyeOff size={12} /> : <Eye size={12} />}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={v.secret}
                        onChange={(e) => updateVariable(i, 'secret', e.target.checked)}
                        className="accent-[var(--color-accent)]"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => deleteVariable(i)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                        title="Delete variable"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-accent text-[var(--color-bg-primary)] rounded-lg text-sm font-medium hover:opacity-90 transition-colors"
        >
          Save
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
