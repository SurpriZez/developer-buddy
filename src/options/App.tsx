import React, { useState } from 'react';
import { SunMoon } from 'lucide-react';
import { useTheme } from '../shared/theme/useTheme';
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
  const { toggleTheme } = useTheme();
  const [activeSection, setActiveSection] = useState<Section>('env');

  return (
    <div className="flex flex-col min-h-screen bg-[var(--color-bg-primary)] text-text-primary text-sm">
      {/* Page header */}
      <header className="bg-header text-white px-6 py-4 flex items-center gap-3">
        <h1 className="text-lg font-semibold">Developer Buddy — Settings</h1>
        <button onClick={toggleTheme} className="ml-auto w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"><SunMoon size={16} className="text-white/80" /></button>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <nav className="w-52 shrink-0 bg-surface border-r border-theme-border pt-4">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                activeSection === item.id
                  ? 'bg-accent-container text-accent font-medium border-r-2 border-accent'
                  : 'text-text-secondary hover:bg-accent-container hover:text-text-primary'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <main className="flex-1 p-8 bg-[var(--color-bg-primary)]">
          {activeSection === 'env'           && <EnvManager />}
          {activeSection === 'user-scripts'  && <UserScriptList />}
          {activeSection === 'docs'          && <DocsManager />}
          {activeSection === 'import-export' && <ImportExport />}
          {activeSection === 'about'         && (
            <div>
              <h2 className="text-lg font-semibold mb-2">Developer Buddy</h2>
              <p className="text-text-muted">Version 0.1.0 — Phase 1 MVP</p>
              <p className="text-text-muted mt-1">Your browser-native developer portal.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
