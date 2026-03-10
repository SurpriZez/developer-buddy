import React, { useState, useEffect, useCallback } from 'react';
import { Send, Plus, Trash2, Copy, ChevronDown, ChevronRight, Save, X } from 'lucide-react';
import { StorageService } from '../../../shared/storage/StorageService';
import type {
  HttpMethod,
  ApiRequestHeader,
  ApiRequestParam,
  ApiRequestBodyType,
  ApiRequest,
  ApiResponse,
  ApiCollection,
  EnvProfile,
} from '../../../shared/types';
import { generateId } from '../../../shared/utils/id';
import { runRequest } from '../../../shared/utils/requestRunner';

type Tab = 'headers' | 'params' | 'body';

function HeaderRow({
  item,
  onChange,
  onDelete,
}: {
  item: ApiRequestHeader;
  onChange: (updated: ApiRequestHeader) => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5 py-1">
      <input
        type="checkbox"
        checked={item.enabled}
        onChange={(e) => onChange({ ...item, enabled: e.target.checked })}
        className="accent-brand-500 shrink-0"
      />
      <input
        type="text"
        value={item.key}
        onChange={(e) => onChange({ ...item, key: e.target.value })}
        placeholder="Key"
        className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
      <input
        type="text"
        value={item.value}
        onChange={(e) => onChange({ ...item, value: e.target.value })}
        placeholder="Value"
        className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
      <button onClick={onDelete} className="text-gray-300 hover:text-red-500 shrink-0">
        <Trash2 size={13} />
      </button>
    </div>
  );
}

function ParamRow({
  item,
  onChange,
  onDelete,
}: {
  item: ApiRequestParam;
  onChange: (updated: ApiRequestParam) => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5 py-1">
      <input
        type="checkbox"
        checked={item.enabled}
        onChange={(e) => onChange({ ...item, enabled: e.target.checked })}
        className="accent-brand-500 shrink-0"
      />
      <input
        type="text"
        value={item.key}
        onChange={(e) => onChange({ ...item, key: e.target.value })}
        placeholder="Key"
        className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
      <input
        type="text"
        value={item.value}
        onChange={(e) => onChange({ ...item, value: e.target.value })}
        placeholder="Value"
        className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
      <button onClick={onDelete} className="text-gray-300 hover:text-red-500 shrink-0">
        <Trash2 size={13} />
      </button>
    </div>
  );
}

function StatusBadge({ status }: { status: number }) {
  const color =
    status >= 200 && status < 300
      ? 'bg-green-100 text-green-700'
      : status >= 300 && status < 400
      ? 'bg-yellow-100 text-yellow-700'
      : 'bg-red-100 text-red-700';

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold font-mono ${color}`}>
      {status}
    </span>
  );
}

function prettyJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

export function ApiTester() {
  const [method, setMethod] = useState<HttpMethod>('GET');
  const [url, setUrl] = useState('');
  const [tab, setTab] = useState<Tab>('params');
  const [headers, setHeaders] = useState<ApiRequestHeader[]>([]);
  const [params, setParams] = useState<ApiRequestParam[]>([]);
  const [bodyType, setBodyType] = useState<ApiRequestBodyType>('none');
  const [body, setBody] = useState('');
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [responseHeadersOpen, setResponseHeadersOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveCollectionId, setSaveCollectionId] = useState<string | null>(null);
  const [collections, setCollections] = useState<ApiCollection[]>([]);
  const [savedRequests, setSavedRequests] = useState<ApiRequest[]>([]);
  const [savedPanelOpen, setSavedPanelOpen] = useState(false);
  const [activeProfile, setActiveProfile] = useState<EnvProfile | null>(null);

  const loadData = useCallback(async () => {
    const [cols, reqs, profile] = await Promise.all([
      StorageService.getApiCollections(),
      StorageService.getApiRequests(),
      StorageService.getActiveProfile(),
    ]);
    setCollections(cols);
    setSavedRequests(reqs);
    setActiveProfile(profile);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSend = async () => {
    if (!url.trim()) { setError('URL is required.'); return; }
    setError('');
    setLoading(true);
    setResponse(null);
    try {
      const req: ApiRequest = {
        id: generateId(),
        name: '',
        method,
        url,
        headers,
        params,
        bodyType,
        body,
        collectionId: null,
        createdAt: new Date().toISOString(),
      };
      const res = await runRequest(req, activeProfile);
      setResponse(res);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!saveName.trim()) return;
    const req: ApiRequest = {
      id: generateId(),
      name: saveName.trim(),
      method,
      url,
      headers,
      params,
      bodyType,
      body,
      collectionId: saveCollectionId,
      createdAt: new Date().toISOString(),
    };
    await StorageService.saveApiRequest(req);
    if (saveCollectionId) {
      const cols = await StorageService.getApiCollections();
      const col = cols.find((c) => c.id === saveCollectionId);
      if (col) {
        await StorageService.saveApiCollection({
          ...col,
          requestIds: [...col.requestIds, req.id],
        });
      }
    }
    setShowSaveModal(false);
    setSaveName('');
    loadData();
  };

  const loadRequest = (req: ApiRequest) => {
    setMethod(req.method);
    setUrl(req.url);
    setHeaders(req.headers);
    setParams(req.params);
    setBodyType(req.bodyType);
    setBody(req.body);
    setResponse(null);
    setSavedPanelOpen(false);
  };

  const copyBody = () => {
    if (!response) return;
    navigator.clipboard.writeText(response.body).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
  const methodColors: Record<HttpMethod, string> = {
    GET: 'text-green-600',
    POST: 'text-blue-600',
    PUT: 'text-yellow-600',
    PATCH: 'text-orange-600',
    DELETE: 'text-red-600',
    OPTIONS: 'text-purple-600',
  };

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Saved requests toggle */}
      <button
        onClick={() => setSavedPanelOpen((o) => !o)}
        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 font-medium"
      >
        {savedPanelOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        Saved Requests ({savedRequests.length})
      </button>

      {savedPanelOpen && (
        <div className="border border-gray-200 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
          {savedRequests.length === 0 ? (
            <p className="text-xs text-gray-400 p-3">No saved requests.</p>
          ) : (
            savedRequests.map((r) => (
              <button
                key={r.id}
                onClick={() => loadRequest(r)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-brand-50 border-b border-gray-100 last:border-0"
              >
                <span className={`text-xs font-mono font-bold shrink-0 ${methodColors[r.method]}`}>
                  {r.method}
                </span>
                <span className="text-xs text-gray-700 truncate">{r.name}</span>
              </button>
            ))
          )}
        </div>
      )}

      {/* Method + URL + Send */}
      <div className="flex gap-1.5 items-stretch">
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as HttpMethod)}
          className={`border border-gray-200 rounded-lg px-2 py-2 text-xs font-semibold font-mono focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white shrink-0 ${methodColors[method]}`}
        >
          {METHODS.map((m) => (
            <option key={m} value={m} className="text-gray-900">
              {m}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://api.example.com/endpoint"
          className="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        />
        <button
          onClick={handleSend}
          disabled={loading}
          className="shrink-0 inline-flex items-center gap-1 px-3 py-2 bg-brand-600 text-white rounded-lg text-xs font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          <Send size={13} />
          {loading ? 'Sending…' : 'Send'}
        </button>
        <button
          onClick={() => { setShowSaveModal(true); setSaveName(''); }}
          className="shrink-0 inline-flex items-center gap-1 px-3 py-2 border border-gray-200 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors"
          title="Save request"
        >
          <Save size={13} />
        </button>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* Tabs */}
      <div className="flex gap-0 border-b border-gray-200">
        {(['headers', 'params', 'body'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs font-medium capitalize border-b-2 -mb-px transition-colors ${
              tab === t
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="min-h-24">
        {tab === 'headers' && (
          <div className="space-y-0.5">
            {headers.map((h, i) => (
              <HeaderRow
                key={i}
                item={h}
                onChange={(u) => setHeaders((hs) => hs.map((x, j) => (j === i ? u : x)))}
                onDelete={() => setHeaders((hs) => hs.filter((_, j) => j !== i))}
              />
            ))}
            <button
              onClick={() => setHeaders((hs) => [...hs, { key: '', value: '', enabled: true }])}
              className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 mt-1"
            >
              <Plus size={12} /> Add Header
            </button>
          </div>
        )}

        {tab === 'params' && (
          <div className="space-y-0.5">
            {params.map((p, i) => (
              <ParamRow
                key={i}
                item={p}
                onChange={(u) => setParams((ps) => ps.map((x, j) => (j === i ? u : x)))}
                onDelete={() => setParams((ps) => ps.filter((_, j) => j !== i))}
              />
            ))}
            <button
              onClick={() => setParams((ps) => [...ps, { key: '', value: '', enabled: true }])}
              className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 mt-1"
            >
              <Plus size={12} /> Add Param
            </button>
          </div>
        )}

        {tab === 'body' && (
          <div className="space-y-2">
            <select
              value={bodyType}
              onChange={(e) => setBodyType(e.target.value as ApiRequestBodyType)}
              className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="none">None</option>
              <option value="json">JSON</option>
              <option value="form-data">Form Data</option>
              <option value="raw">Raw</option>
            </select>
            {bodyType !== 'none' && (
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={bodyType === 'json' ? '{\n  "key": "value"\n}' : 'Request body...'}
                rows={5}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
              />
            )}
          </div>
        )}
      </div>

      {/* Response */}
      {response && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200">
            <StatusBadge status={response.status} />
            <span className="text-xs text-gray-500">{response.statusText}</span>
            <span className="text-xs text-gray-400 ml-auto">{response.durationMs}ms</span>
            <button
              onClick={copyBody}
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 ml-1"
              title="Copy body"
            >
              <Copy size={12} />
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          {/* Response headers collapsible */}
          <div className="border-b border-gray-200">
            <button
              onClick={() => setResponseHeadersOpen((o) => !o)}
              className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
            >
              {responseHeadersOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              Response Headers ({Object.keys(response.headers).length})
            </button>
            {responseHeadersOpen && (
              <div className="px-3 pb-2 space-y-0.5 max-h-32 overflow-y-auto">
                {Object.entries(response.headers).map(([k, v]) => (
                  <div key={k} className="flex gap-2 text-xs font-mono">
                    <span className="text-gray-500 shrink-0">{k}:</span>
                    <span className="text-gray-700 break-all">{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <pre className="p-3 text-xs font-mono text-gray-800 overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap break-all">
            {prettyJson(response.body) || <span className="text-gray-400">(empty body)</span>}
          </pre>
        </div>
      )}

      {/* Save modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-5 w-72 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-gray-900">Save Request</h3>
              <button onClick={() => setShowSaveModal(false)}>
                <X size={16} className="text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Request name"
              autoFocus
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <select
              value={saveCollectionId ?? ''}
              onChange={(e) => setSaveCollectionId(e.target.value || null)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">No collection</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={!saveName.trim()}
                className="flex-1 px-3 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => setShowSaveModal(false)}
                className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
