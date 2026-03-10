import React, { useEffect, useState, useCallback } from 'react';
import { ToggleLeft, ToggleRight, Code, Settings } from 'lucide-react';
import { StorageService } from '../../../shared/storage/StorageService';
import { syncUserScriptRegistrations } from '../../../shared/utils/userScriptRegistrar';
import type { UserScript } from '../../../shared/types';

export function UserScriptPanel() {
  const [scripts, setScripts] = useState<UserScript[]>([]);

  const load = useCallback(async () => {
    const all = await StorageService.getUserScripts();
    setScripts(all);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggle = async (script: UserScript) => {
    await StorageService.saveUserScript({ ...script, enabled: !script.enabled });
    await syncUserScriptRegistrations();
    load();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Code size={15} className="text-brand-500" />
          <span className="text-sm font-semibold text-gray-800">Installed Scripts</span>
        </div>
        <button
          onClick={() => chrome.runtime.openOptionsPage()}
          className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium"
        >
          <Settings size={12} />
          Manage Scripts →
        </button>
      </div>

      {scripts.length === 0 ? (
        <div className="text-center py-10 text-gray-400 space-y-2">
          <Code size={28} className="mx-auto text-gray-300" />
          <p className="text-sm">No user scripts installed.</p>
          <p className="text-xs">Create scripts in Settings to run them automatically on matching pages.</p>
          <button
            onClick={() => chrome.runtime.openOptionsPage()}
            className="mt-1 text-xs text-brand-600 hover:underline"
          >
            Open Settings →
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {scripts.map((s) => (
            <div
              key={s.id}
              className={`flex items-start gap-2.5 px-3 py-2.5 border rounded-lg ${
                s.enabled ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-gray-900">{s.name}</span>
                  <span className="text-xs text-gray-400 font-mono">v{s.version}</span>
                </div>
                {s.matchPatterns.length > 0 && (
                  <p className="text-xs text-gray-400 truncate mt-0.5">
                    {s.matchPatterns[0]}
                    {s.matchPatterns.length > 1 && ` +${s.matchPatterns.length - 1} more`}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleToggle(s)}
                className={`shrink-0 mt-0.5 transition-colors ${
                  s.enabled ? 'text-brand-500 hover:text-brand-700' : 'text-gray-300 hover:text-gray-500'
                }`}
                title={s.enabled ? 'Disable' : 'Enable'}
              >
                {s.enabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
