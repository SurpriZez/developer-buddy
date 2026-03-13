// src/side-panel/modules/actions/ActionsPanel.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Play, AlertCircle, CheckCircle2 } from 'lucide-react';
import { StorageService } from '../../../shared/storage/StorageService';
import type { SelfServiceAction, ActionVariable, EnvProfile } from '../../../shared/types';
import { interpolate } from '../../../shared/utils/interpolate';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const METHOD_COLORS: Record<SelfServiceAction['method'], string> = {
  GET:    'bg-blue-500/10 text-blue-500 border-blue-500/30',
  POST:   'bg-green-500/10 text-green-500 border-green-500/30',
  PUT:    'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
  PATCH:  'bg-orange-500/10 text-orange-500 border-orange-500/30',
  DELETE: 'bg-red-500/10 text-red-500 border-red-500/30',
};

function buildProfile(variables: ActionVariable[]): EnvProfile {
  return { id: '', name: 'action-variables', isActive: true, variables };
}

function statusColor(status: number): string {
  if (status >= 200 && status < 300) return 'text-green-500';
  if (status >= 400) return 'text-red-400';
  return 'text-yellow-500';
}

// ---------------------------------------------------------------------------
// Action result type
// ---------------------------------------------------------------------------

type ActionResult =
  | { state: 'success'; status: number; statusText: string; body: string; durationMs: number }
  | { state: 'error'; message: string };

// ---------------------------------------------------------------------------
// Single action card
// ---------------------------------------------------------------------------

function ActionCard({
  action,
  variables,
}: {
  action: SelfServiceAction;
  variables: ActionVariable[];
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  const fire = useCallback(async () => {
    setConfirmOpen(false);
    setRunning(true);
    setResult(null);
    const profile = buildProfile(variables);
    const url = interpolate(action.url, profile);
    const enabledHeaders = action.headers.filter((h) => h.enabled && h.key.trim());
    const headersInit: Record<string, string> = {};
    for (const h of enabledHeaders) {
      headersInit[interpolate(h.key, profile)] = interpolate(h.value, profile);
    }
    const hasBody = ['POST', 'PUT', 'PATCH'].includes(action.method) && action.body.trim();
    const bodyInit = hasBody ? interpolate(action.body, profile) : undefined;
    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(url, {
        method: action.method,
        headers: headersInit,
        signal: controller.signal,
        ...(bodyInit ? { body: bodyInit } : {}),
      });
      const raw = await res.text();
      const truncated = raw.length > 300 ? raw.slice(0, 300) + '…' : raw;
      setResult({
        state: 'success',
        status: res.status,
        statusText: res.statusText,
        body: truncated,
        durationMs: Date.now() - start,
      });
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === 'AbortError';
      setResult({
        state: 'error',
        message: isTimeout ? 'Request timed out after 10s' : (err instanceof Error ? err.message : 'Request failed'),
      });
    } finally {
      clearTimeout(timeoutId);
      setRunning(false);
    }
  }, [action, variables]);

  const handleClick = () => {
    if (running) return;
    setResult(null);
    if (action.confirmationPrompt) {
      setConfirmOpen(true);
    } else {
      fire();
    }
  };

  return (
    <div className={`border rounded-card overflow-hidden bg-surface transition-colors ${
      confirmOpen ? 'border-accent' : 'border-theme-border'
    }`}>
      {/* Trigger button */}
      <button
        onClick={handleClick}
        disabled={running}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-accent-container transition-colors disabled:opacity-60 text-left"
      >
        {running ? (
          <Loader2 size={12} className="animate-spin text-text-muted shrink-0" />
        ) : (
          <span className={`shrink-0 text-[9px] font-bold font-mono px-1.5 py-0.5 rounded border ${METHOD_COLORS[action.method]}`}>
            {action.method}
          </span>
        )}
        <span className="text-xs font-semibold text-text-primary">{action.name}</span>
      </button>

      {/* Confirmation inline */}
      {confirmOpen && !running && (
        <div className="px-3 pb-3 pt-1 border-t border-theme-border space-y-2">
          <p className="text-xs text-text-secondary">{action.confirmationPrompt}</p>
          <div className="flex gap-2">
            <button
              onClick={fire}
              className="flex-1 px-3 py-1.5 bg-red-500 text-white rounded-card text-xs font-semibold hover:bg-red-600 transition-colors"
            >
              Confirm
            </button>
            <button
              onClick={() => setConfirmOpen(false)}
              className="flex-1 px-3 py-1.5 border border-theme-border rounded-card text-xs text-text-secondary hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Result */}
      {result && !confirmOpen && (
        <div className="px-3 pb-3 pt-1 border-t border-theme-border space-y-1.5">
          {result.state === 'success' && (
            <>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={11} className="text-green-500 shrink-0" />
                <span className={`text-xs font-bold ${statusColor(result.status)}`}>
                  {result.status} {result.statusText}
                </span>
                <span className="text-[10px] text-text-muted">{result.durationMs}ms</span>
              </div>
              {result.body && (
                <pre className="text-[10px] font-mono text-text-secondary bg-[var(--color-bg-primary)] border border-theme-border rounded p-2 whitespace-pre-wrap break-all leading-relaxed max-h-24 overflow-auto">
                  {result.body}
                </pre>
              )}
            </>
          )}
          {result.state === 'error' && (
            <div className="flex items-start gap-1.5 text-xs text-red-400">
              <AlertCircle size={11} className="shrink-0 mt-0.5" />
              <span>{result.message}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function ActionsPanel() {
  const [actions, setActions] = useState<SelfServiceAction[]>([]);
  const [variables, setVariables] = useState<ActionVariable[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      StorageService.getSelfServiceActions(),
      StorageService.getActionVariables(),
    ]).then(([acts, vars]) => {
      setActions(acts);
      setVariables(vars);
      setLoaded(true);
    });
  }, []);

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-12 text-text-muted">
        <Loader2 size={18} className="animate-spin" />
      </div>
    );
  }

  if (actions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2 text-text-muted">
        <Play size={24} className="opacity-40" />
        <p className="text-xs">No actions defined.</p>
        <p className="text-xs">Go to Settings → Actions to create one.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {actions.map((action) => (
        <ActionCard key={action.id} action={action} variables={variables} />
      ))}
    </div>
  );
}
