import React, { useState } from 'react';
import type { Script, ScriptLanguage } from '../../../shared/types';
import { generateId } from '../../../shared/utils/id';

interface Props {
  initial?: Script;
  onSave: (script: Script) => void;
  onCancel: () => void;
}

export function ScriptEditor({ initial, onSave, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [language, setLanguage] = useState<ScriptLanguage>(initial?.language ?? 'javascript');
  const [tags, setTags] = useState(initial?.tags.join(', ') ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [isPinned, setIsPinned] = useState(initial?.isPinned ?? false);
  const [error, setError] = useState('');

  const handleSave = () => {
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    const script: Script = {
      id: initial?.id ?? generateId(),
      name: name.trim(),
      description: description.trim(),
      language,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      body,
      isPinned,
      createdAt: initial?.createdAt ?? new Date().toISOString(),
      lastRunAt: initial?.lastRunAt ?? null,
    };
    onSave(script);
  };

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-semibold text-base">{initial ? 'Edit Script' : 'New Script'}</h2>

      {error && <p className="text-red-500 text-xs">{error}</p>}

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
        <input
          className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-brand-500"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Flush Redis Cache"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
        <textarea
          className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-brand-500 resize-none"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does this script do?"
        />
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">Language</label>
          <select
            className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-brand-500"
            value={language}
            onChange={(e) => setLanguage(e.target.value as ScriptLanguage)}
          >
            <option value="javascript">JavaScript</option>
            <option value="shell">Shell</option>
          </select>
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              className="accent-brand-500"
            />
            Pin
          </label>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Tags (comma-separated)</label>
        <input
          className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-brand-500"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="e.g. redis, cache, local"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Body</label>
        <textarea
          className="w-full border border-gray-200 rounded px-2 py-1 text-sm font-mono focus:outline-none focus:border-brand-500 resize-y"
          rows={10}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={language === 'javascript' ? '// Your JavaScript here\nconsole.log("hello");' : '# Your shell command here\necho "hello"'}
          spellCheck={false}
        />
      </div>

      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-3 py-1.5 text-sm rounded bg-brand-500 text-white hover:bg-brand-600"
        >
          Save
        </button>
      </div>
    </div>
  );
}
