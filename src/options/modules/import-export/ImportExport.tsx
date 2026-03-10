import React, { useRef, useState } from 'react';
import { Download, Upload, AlertTriangle, CheckCircle } from 'lucide-react';
import { StorageService } from '../../../shared/storage/StorageService';
import { syncUserScriptRegistrations } from '../../../shared/utils/userScriptRegistrar';
import type { StorageSchema } from '../../../shared/types';

const REQUIRED_KEYS: (keyof StorageSchema)[] = [
  'scripts',
  'envProfiles',
  'apiRequests',
  'apiCollections',
  'docSources',
  'userScripts',
];

function isValidSchema(obj: unknown): obj is StorageSchema {
  if (typeof obj !== 'object' || obj === null) return false;
  return REQUIRED_KEYS.every((k) => k in (obj as Record<string, unknown>));
}

export function ImportExport() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState(false);
  const [confirmPending, setConfirmPending] = useState<StorageSchema | null>(null);

  const handleExport = async () => {
    const data = await StorageService.exportAll();

    // Strip secret variable values
    const sanitized: StorageSchema = {
      ...data,
      envProfiles: data.envProfiles.map((p) => ({
        ...p,
        variables: p.variables.map((v) =>
          v.secret ? { ...v, value: '' } : v
        ),
      })),
    };

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `developer-buddy-backup-${dateStr}.json`;
    const blob = new Blob([JSON.stringify(sanitized, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError('');
    setImportSuccess(false);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const parsed = JSON.parse(text) as unknown;
        if (!isValidSchema(parsed)) {
          setImportError(
            'Invalid backup file. Expected keys: ' + REQUIRED_KEYS.join(', ')
          );
          return;
        }
        setConfirmPending(parsed);
      } catch {
        setImportError('Failed to parse file. Make sure it is a valid JSON backup.');
      }
    };
    reader.readAsText(file);

    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  const handleConfirmImport = async () => {
    if (!confirmPending) return;
    try {
      await StorageService.importAll(confirmPending);
      await syncUserScriptRegistrations();
      setConfirmPending(null);
      setImportSuccess(true);
      setTimeout(() => setImportSuccess(false), 4000);
    } catch (err) {
      setImportError(String(err));
      setConfirmPending(null);
    }
  };

  return (
    <div className="space-y-8 max-w-lg">
      <h2 className="text-base font-semibold text-gray-900">Import / Export</h2>

      {/* Export */}
      <div className="border border-gray-200 rounded-xl p-5 bg-white space-y-3">
        <div className="flex items-center gap-2">
          <Download size={16} className="text-brand-500" />
          <h3 className="font-semibold text-sm text-gray-900">Export Data</h3>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">
          Download all your scripts, profiles, requests, and settings as a JSON
          file.
        </p>
        <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
          <AlertTriangle size={13} className="text-yellow-600 mt-0.5 shrink-0" />
          <p className="text-xs text-yellow-700">
            Secret variable values are stripped from the export for security.
          </p>
        </div>
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          <Download size={14} />
          Export Backup
        </button>
      </div>

      {/* Import */}
      <div className="border border-gray-200 rounded-xl p-5 bg-white space-y-3">
        <div className="flex items-center gap-2">
          <Upload size={16} className="text-brand-500" />
          <h3 className="font-semibold text-sm text-gray-900">Import Data</h3>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">
          Restore from a Developer Buddy backup file (.json). This will replace all
          existing data.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          onClick={() => { setImportError(''); setImportSuccess(false); fileInputRef.current?.click(); }}
          className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          <Upload size={14} />
          Choose Backup File
        </button>

        {importError && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertTriangle size={13} className="text-red-500 mt-0.5 shrink-0" />
            <p className="text-xs text-red-700">{importError}</p>
          </div>
        )}

        {importSuccess && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            <CheckCircle size={13} className="text-green-500 shrink-0" />
            <p className="text-xs text-green-700">Data imported successfully!</p>
          </div>
        )}
      </div>

      {/* Confirm dialog */}
      {confirmPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-80 space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-yellow-500" />
              <h3 className="font-semibold text-sm text-gray-900">Replace All Data?</h3>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              This will replace all existing data with the contents of the backup
              file. This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleConfirmImport}
                className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
              >
                Replace All Data
              </button>
              <button
                onClick={() => setConfirmPending(null)}
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
