import React, { useState, useEffect, useCallback } from 'react';
import { Terminal, Zap, BookOpen, GitPullRequest, Code, Settings, ArrowLeft, SunMoon } from 'lucide-react';
import { StorageService } from '../shared/storage/StorageService';
import type { EnvProfile } from '../shared/types';
import { ScriptList } from './modules/scripts/ScriptList';
import { ApiTester } from './modules/api-tester/ApiTester';
import { DocsList } from './modules/docs/DocsList';
import { SelfService } from './modules/self-service/SelfService';
import { UserScriptPanel } from './modules/user-scripts/UserScriptPanel';
import { useTheme } from '../shared/theme/useTheme';

type Module = 'scripts' | 'api' | 'docs' | 'pr' | 'user-scripts';

interface ModuleDef {
  id: Module;
  label: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
}

function getGreeting(name: string): string {
  const hour = new Date().getHours();
  const period =
    hour >= 5 && hour < 12 ? 'Morning' :
    hour >= 12 && hour < 17 ? 'Afternoon' :
    hour >= 17 && hour < 21 ? 'Evening' : 'Night';
  return name ? `${period}, ${name}` : 'Developer Buddy';
}

const MODULES: ModuleDef[] = [
  { id: 'user-scripts', label: 'RPA',          Icon: Code },
  { id: 'scripts',      label: 'Scripts',      Icon: Terminal },
  { id: 'api',          label: 'API Tester',   Icon: Zap },
  { id: 'docs',         label: 'Docs',         Icon: BookOpen },
  { id: 'pr',           label: 'PR & Actions', Icon: GitPullRequest },
];

function EnvBadge({
  activeProfile,
  profiles,
  onSwitch,
}: {
  activeProfile: EnvProfile | null;
  profiles: EnvProfile[];
  onSwitch: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white/15 text-white border border-white/20 hover:bg-white/25 transition-colors"
      >
        <span className={`w-1.5 h-1.5 rounded-full ${activeProfile ? 'bg-green-400' : 'bg-white/30'}`} />
        {activeProfile ? `ENV: ${activeProfile.name}` : 'No environment'}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-50 bg-surface border border-theme-border rounded-card shadow-lg min-w-44 py-1">
            {profiles.length === 0 ? (
              <div className="px-3 py-2 text-xs text-text-muted">No profiles — add in Settings</div>
            ) : (
              profiles.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { onSwitch(p.id); setOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-accent-container flex items-center gap-2 ${
                    p.isActive ? 'font-semibold text-accent bg-accent-container' : 'text-text-primary'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${p.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                  {p.name}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

function HomeScreen({
  activeProfile,
  profiles,
  onNavigate,
  onSwitchProfile,
  onOpenSettings,
  toggleTheme,
  greeting,
}: {
  activeProfile: EnvProfile | null;
  profiles: EnvProfile[];
  onNavigate: (m: Module) => void;
  onSwitchProfile: (id: string) => void;
  onOpenSettings: () => void;
  toggleTheme: () => void;
  greeting: string;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-header flex items-center gap-2 px-3 py-3 border-b border-theme-border">
        <span className="text-white font-bold flex-1 text-sm">{greeting}</span>
        <EnvBadge activeProfile={activeProfile} profiles={profiles} onSwitch={onSwitchProfile} />
        <button onClick={toggleTheme} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors">
          <SunMoon size={16} className="text-white/80" />
        </button>
        <button onClick={onOpenSettings} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors">
          <Settings size={16} className="text-white/80" />
        </button>
      </div>

      {/* Module grid */}
      <div className="flex-1 overflow-auto p-3">
        <div className="grid grid-cols-2 gap-2">
          {MODULES.map((mod) => (
            <button
              key={mod.id}
              onClick={() => onNavigate(mod.id)}
              className="h-[88px] flex flex-col items-center justify-center gap-1.5 bg-surface border border-theme-border rounded-card hover:bg-accent-container hover:border-accent transition-all cursor-pointer"
            >
              <mod.Icon size={22} className="text-accent" />
              <span className="text-xs font-semibold text-text-primary">{mod.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ModuleHeader({
  label,
  onBack,
  onOpenSettings,
}: {
  label: string;
  onBack: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <div className="bg-header flex items-center gap-2 px-3 py-3 border-b border-theme-border shrink-0">
      <button onClick={onBack} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors">
        <ArrowLeft size={16} className="text-white/80" />
      </button>
      <span className="text-white font-semibold flex-1 text-sm">{label}</span>
      <button onClick={onOpenSettings} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors">
        <Settings size={16} className="text-white/80" />
      </button>
    </div>
  );
}

export default function App() {
  const { toggleTheme } = useTheme();
  const [activeModule, setActiveModule] = useState<Module | null>(null);
  // Keep the last module rendered so it stays visible during the slide-back animation
  const [renderedModule, setRenderedModule] = useState<Module | null>(null);
  const [activeProfile, setActiveProfile] = useState<EnvProfile | null>(null);
  const [profiles, setProfiles] = useState<EnvProfile[]>([]);
  const [userName, setUserName] = useState('');

  const loadProfiles = useCallback(async () => {
    const [all, active] = await Promise.all([
      StorageService.getEnvProfiles(),
      StorageService.getActiveProfile(),
    ]);
    setProfiles(all);
    setActiveProfile(active);
  }, []);

  useEffect(() => {
    loadProfiles();
    chrome.storage.local.get('developer_buddy_user').then((r) => {
      const user = r['developer_buddy_user'] as { name?: string } | undefined;
      if (user?.name) setUserName(user.name);
    });
  }, [loadProfiles]);

  const handleSwitchProfile = async (id: string) => {
    await StorageService.setActiveProfile(id);
    loadProfiles();
  };

  const handleOpenSettings = () => {
    chrome.runtime.openOptionsPage();
  };

  const handleNavigate = (mod: Module) => {
    setRenderedModule(mod);
    setActiveModule(mod);
  };

  const handleBack = () => {
    setActiveModule(null);
    // Clear renderedModule after the slide-back animation completes
    setTimeout(() => setRenderedModule(null), 300);
  };

  const activeModuleDef = MODULES.find((m) => m.id === (activeModule ?? renderedModule));

  return (
    <div className="h-screen overflow-hidden bg-[var(--color-bg-primary)] text-text-primary text-sm">
      {/* Sliding track: 200% wide, two panels side by side */}
      <div
        className="flex h-full transition-transform duration-300 ease-in-out"
        style={{
          width: '200%',
          transform: activeModule ? 'translateX(-50%)' : 'translateX(0)',
        }}
      >
        {/* Panel 1: Home */}
        <div className="h-full flex flex-col" style={{ width: '50%' }}>
          <HomeScreen
            activeProfile={activeProfile}
            profiles={profiles}
            onNavigate={handleNavigate}
            onSwitchProfile={handleSwitchProfile}
            onOpenSettings={handleOpenSettings}
            toggleTheme={toggleTheme}
            greeting={getGreeting(userName)}
          />
        </div>

        {/* Panel 2: Module view */}
        <div className="h-full flex flex-col overflow-hidden" style={{ width: '50%' }}>
          <ModuleHeader
            label={activeModuleDef?.label ?? ''}
            onBack={handleBack}
            onOpenSettings={handleOpenSettings}
          />
          <div className="flex-1 overflow-auto p-3">
            {renderedModule === 'scripts'      && <ScriptList />}
            {renderedModule === 'api'          && <ApiTester />}
            {renderedModule === 'docs'         && <DocsList />}
            {renderedModule === 'pr'           && <SelfService />}
            {renderedModule === 'user-scripts' && <UserScriptPanel />}
          </div>
        </div>
      </div>
    </div>
  );
}
