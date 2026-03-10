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
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          {profile ? 'Edit Profile' : 'New Profile'}
        </h2>

        <label className="block text-xs font-medium text-gray-700 mb-1">
          Profile Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setError(''); }}
          placeholder="e.g. Production"
          className="w-full max-w-sm border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
            Variables
          </h3>
          <button
            onClick={addVariable}
            className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium"
          >
            <Plus size={14} />
            Add Variable
          </button>
        </div>

        {variables.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">
            No variables. Click "Add Variable" to get started.
          </p>
        ) : (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-3 py-2 font-medium w-2/5">Key</th>
                  <th className="text-left px-3 py-2 font-medium w-2/5">Value</th>
                  <th className="text-center px-3 py-2 font-medium w-16">Secret</th>
                  <th className="px-3 py-2 w-10" />
                </tr>
              </thead>
              <tbody>
                {variables.map((v, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={v.key}
                        onChange={(e) => updateVariable(i, 'key', e.target.value)}
                        placeholder="KEY_NAME"
                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="relative flex items-center">
                        <input
                          type={v.secret && !revealed[i] ? 'password' : 'text'}
                          value={v.value}
                          onChange={(e) => updateVariable(i, 'value', e.target.value)}
                          placeholder="value"
                          className="w-full border border-gray-200 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-brand-500 pr-7"
                        />
                        {v.secret && (
                          <button
                            type="button"
                            onClick={() => toggleReveal(i)}
                            className="absolute right-1.5 text-gray-400 hover:text-gray-600"
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
                        className="accent-brand-500"
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
          className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
