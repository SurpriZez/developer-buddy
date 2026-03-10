import React, { useState } from 'react';
import { EnvManager } from './modules/env-manager/EnvManager';
import { UserScriptList } from './modules/user-scripts/UserScriptList';
import { DocsManager } from './modules/docs/DocsManager';
import { ImportExport } from './modules/import-export/ImportExport';

type Section = 'env' | 'user-scripts' | 'docs' | 'import-export' | 'about';

const NAV: { id: Section; label: string }[] = [
  { id: 'env',           label: 'Environment Profiles' },
  { id: 'user-scripts',  label: 'User Scripts' },
  { id: 'docs',          label: 'Documentation' },
  { id: 'import-export', label: 'Import / Export' },
  { id: 'about',         label: 'About' },
];

export default function App() {
  const [activeSection, setActiveSection] = useState<Section>('env');

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 text-gray-900 text-sm">
      {/* Page header */}
      <header className="bg-brand-900 text-white px-6 py-4">
        <h1 className="text-lg font-semibold">Developer Buddy — Settings</h1>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <nav className="w-52 shrink-0 bg-white border-r border-gray-200 pt-4">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                activeSection === item.id
                  ? 'bg-brand-50 text-brand-600 font-medium border-r-2 border-brand-500'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <main className="flex-1 p-8">
          {activeSection === 'env'           && <EnvManager />}
          {activeSection === 'user-scripts'  && <UserScriptList />}
          {activeSection === 'docs'          && <DocsManager />}
          {activeSection === 'import-export' && <ImportExport />}
          {activeSection === 'about'         && (
            <div>
              <h2 className="text-lg font-semibold mb-2">Developer Buddy</h2>
              <p className="text-gray-500">Version 0.1.0 — Phase 1 MVP</p>
              <p className="text-gray-500 mt-1">Your browser-native developer portal.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
