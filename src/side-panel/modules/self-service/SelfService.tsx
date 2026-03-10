import React from 'react';
import { GitPullRequest, Settings, ExternalLink } from 'lucide-react';

export function SelfService() {
  const openOptions = () => chrome.runtime.openOptionsPage();

  return (
    <div className="flex flex-col gap-4">
      {/* PR Status */}
      <div className="border border-gray-200 rounded-xl p-4 bg-white space-y-3">
        <div className="flex items-center gap-2">
          <GitPullRequest size={16} className="text-brand-500" />
          <h2 className="text-sm font-semibold text-gray-900">PR Status</h2>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">
          Connect GitHub to see your open pull requests.
        </p>
        <button
          onClick={openOptions}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-brand-600 text-white rounded-lg text-xs font-medium hover:bg-brand-700 transition-colors"
        >
          <ExternalLink size={12} />
          Connect GitHub →
        </button>
      </div>

      {/* Self-Service Actions */}
      <div className="border border-gray-200 rounded-xl p-4 bg-white space-y-3">
        <div className="flex items-center gap-2">
          <Settings size={16} className="text-brand-500" />
          <h2 className="text-sm font-semibold text-gray-900">Self-Service Actions</h2>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">
          No actions configured.
        </p>
        <button
          onClick={openOptions}
          className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors"
        >
          <Settings size={12} />
          Configure in Settings →
        </button>
      </div>
    </div>
  );
}
