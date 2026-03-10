import React, { useEffect, useState, useCallback } from 'react';
import { BookOpen, ExternalLink, Pin, Trash2, Plus } from 'lucide-react';
import { StorageService } from '../../../shared/storage/StorageService';
import type { DocSource } from '../../../shared/types';

export function DocsList() {
  const [sources, setSources] = useState<DocSource[]>([]);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    const all = await StorageService.getDocSources();
    setSources(all);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: string) => {
    await StorageService.deleteDocSource(id);
    load();
  };

  const handleOpen = (url: string) => {
    chrome.tabs.create({ url });
  };

  const filtered = sources
    .filter((s) => {
      const q = search.toLowerCase();
      return (
        q === '' ||
        s.name.toLowerCase().includes(q) ||
        s.url.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return a.name.localeCompare(b.name);
    });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search docs…"
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button
          onClick={() => chrome.runtime.openOptionsPage()}
          className="shrink-0 inline-flex items-center gap-1 px-2.5 py-2 border border-gray-200 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors"
          title="Add source in settings"
        >
          <Plus size={13} />
          Add
        </button>
      </div>

      {filtered.length === 0 && sources.length === 0 && (
        <div className="text-center py-10 text-gray-400 space-y-2">
          <BookOpen size={28} className="mx-auto text-gray-300" />
          <p className="text-sm">No documentation sources yet.</p>
          <p className="text-xs">Add sources in Settings to get started.</p>
          <button
            onClick={() => chrome.runtime.openOptionsPage()}
            className="mt-1 text-xs text-brand-600 hover:underline"
          >
            Open Settings →
          </button>
        </div>
      )}

      {filtered.length === 0 && sources.length > 0 && (
        <p className="text-xs text-gray-400 text-center py-6">
          No results for "{search}"
        </p>
      )}

      <div className="space-y-2">
        {filtered.map((s) => (
          <div
            key={s.id}
            className="flex items-start gap-2 px-3 py-2.5 border border-gray-200 rounded-lg bg-white hover:border-gray-300 transition-colors"
          >
            <BookOpen size={15} className="text-brand-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-gray-900 truncate">
                  {s.name}
                </span>
                {s.isPinned && (
                  <Pin size={11} className="text-brand-500 shrink-0" />
                )}
              </div>
              <p className="text-xs text-gray-400 truncate mt-0.5">{s.url}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => handleOpen(s.url)}
                className="p-1.5 text-brand-500 hover:bg-brand-50 rounded transition-colors"
                title="Open"
              >
                <ExternalLink size={13} />
              </button>
              <button
                onClick={() => handleDelete(s.id)}
                className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                title="Delete"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
