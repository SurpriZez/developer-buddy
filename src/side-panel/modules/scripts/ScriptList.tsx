import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pencil, Trash2, Pin, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { StorageService } from '../../../shared/storage/StorageService';
import type { Script } from '../../../shared/types';
import { ScriptEditor } from './ScriptEditor';

interface ScriptOutput {
  output: string[];
  error: string | null;
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  return d.toLocaleString();
}

function LanguageBadge({ language }: { language: Script['language'] }) {
  return (
    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
      language === 'javascript'
        ? 'bg-yellow-100 text-yellow-700'
        : 'bg-gray-100 text-gray-600'
    }`}>
      {language === 'javascript' ? 'JS' : 'Shell'}
    </span>
  );
}

function OutputPanel({ result }: { result: ScriptOutput }) {
  return (
    <div className="mt-2 rounded bg-gray-900 text-green-400 font-mono text-xs p-2 whitespace-pre-wrap">
      {result.output.length > 0 && <div>{result.output.join('\n')}</div>}
      {result.error && (
        <div className="text-red-400">{result.error}</div>
      )}
      {result.output.length === 0 && !result.error && (
        <div className="text-gray-500">(no output)</div>
      )}
    </div>
  );
}

export function ScriptList() {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [editing, setEditing] = useState<Script | null | 'new'>(null);
  const [running, setRunning] = useState<Set<string>>(new Set());
  const [outputs, setOutputs] = useState<Record<string, ScriptOutput>>({});
  const [expandedOutputs, setExpandedOutputs] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadScripts = useCallback(async () => {
    const all = await StorageService.getScripts();
    // Pinned first, then alphabetical
    const sorted = [...all].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    setScripts(sorted);
  }, []);

  useEffect(() => {
    loadScripts();
  }, [loadScripts]);

  const handleRun = async (script: Script) => {
    setRunning((r) => new Set(r).add(script.id));
    setExpandedOutputs((e) => new Set(e).add(script.id));
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'RUN_SCRIPT',
        payload: { id: script.id, body: script.body, language: script.language },
      });
      setOutputs((o) => ({ ...o, [script.id]: result as ScriptOutput }));
      // Update lastRunAt
      await StorageService.saveScript({ ...script, lastRunAt: new Date().toISOString() });
    } catch (err) {
      setOutputs((o) => ({ ...o, [script.id]: { output: [], error: String(err) } }));
    } finally {
      setRunning((r) => {
        const next = new Set(r);
        next.delete(script.id);
        return next;
      });
    }
  };

  const handleSave = async (script: Script) => {
    await StorageService.saveScript(script);
    setEditing(null);
    loadScripts();
  };

  const handleDelete = async (id: string) => {
    await StorageService.deleteScript(id);
    setDeleteConfirm(null);
    setOutputs((o) => { const next = { ...o }; delete next[id]; return next; });
    loadScripts();
  };

  const toggleOutput = (id: string) => {
    setExpandedOutputs((e) => {
      const next = new Set(e);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (editing === 'new' || editing !== null) {
    return (
      <ScriptEditor
        initial={editing === 'new' ? undefined : editing}
        onSave={handleSave}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-semibold text-base">Scripts</h2>
        <button
          onClick={() => setEditing('new')}
          className="flex items-center gap-1 px-2 py-1 rounded bg-brand-500 text-white text-xs hover:bg-brand-600"
        >
          <Plus size={12} /> New
        </button>
      </div>

      {scripts.length === 0 && (
        <div className="text-gray-400 text-sm py-8 text-center">
          No scripts yet. Click <strong>+ New</strong> to create your first script.
        </div>
      )}

      {scripts.map((script) => (
        <div key={script.id} className="border border-gray-200 rounded-md p-2.5">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                {script.isPinned && <Pin size={11} className="text-brand-500 shrink-0" />}
                <span className="font-medium text-sm truncate">{script.name}</span>
                <LanguageBadge language={script.language} />
              </div>
              {script.description && (
                <p className="text-xs text-gray-500 mt-0.5 truncate">{script.description}</p>
              )}
              {script.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {script.tags.map((tag) => (
                    <span key={tag} className="px-1 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">{tag}</span>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-400 mt-1">Last run: {formatTimestamp(script.lastRunAt)}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => handleRun(script)}
                disabled={running.has(script.id)}
                title="Run"
                className="p-1 rounded hover:bg-green-50 text-green-600 disabled:opacity-50"
              >
                <Play size={14} />
              </button>
              <button
                onClick={() => setEditing(script)}
                title="Edit"
                className="p-1 rounded hover:bg-blue-50 text-blue-600"
              >
                <Pencil size={14} />
              </button>
              {deleteConfirm === script.id ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleDelete(script.id)}
                    className="px-1.5 py-0.5 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setDeleteConfirm(script.id)}
                  title="Delete"
                  className="p-1 rounded hover:bg-red-50 text-red-500"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Output panel toggle */}
          {outputs[script.id] && (
            <div className="mt-2">
              <button
                onClick={() => toggleOutput(script.id)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
              >
                {expandedOutputs.has(script.id) ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                Output
              </button>
              {expandedOutputs.has(script.id) && (
                <OutputPanel result={outputs[script.id]} />
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
