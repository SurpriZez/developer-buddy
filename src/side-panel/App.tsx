import React, { useState, useEffect, useCallback } from 'react';
import { Terminal, Zap, BookOpen, GitPullRequest, Code, Settings, ArrowLeft } from 'lucide-react';
import { StorageService } from '../shared/storage/StorageService';
import type { EnvProfile } from '../shared/types';
import { ScriptList } from './modules/scripts/ScriptList';
import { ApiTester } from './modules/api-tester/ApiTester';
import { DocsList } from './modules/docs/DocsList';
import { SelfService } from './modules/self-service/SelfService';
import { UserScriptPanel } from './modules/user-scripts/UserScriptPanel';

type Module = 'scripts' | 'api' | 'docs' | 'pr' | 'user-scripts';

interface ModuleDef {
  id: Module;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const MODULES: ModuleDef[] = [
  {
    id: 'user-scripts',
    label: 'RPA',
    description: 'Scripts that run automatically on matching pages',
    icon: <Code size={20} />,
  },
  {
    id: 'scripts',
    label: 'Scripts',
    description: 'Run and manage JS scripts',
    icon: <Terminal size={20} />,
  },
  {
    id: 'api',
    label: 'API Tester',
    description: 'Build and send HTTP requests',
    icon: <Zap size={20} />,
  },
  {
    id: 'docs',
    label: 'Docs',
    description: 'Quick-access documentation',
    icon: <BookOpen size={20} />,
  },
  {
    id: 'pr',
    label: 'PR & Actions',
    description: 'Pull requests and self-service',
    icon: <GitPullRequest size={20} />,
  },
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
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white/10 hover:bg-white/20 transition-colors text-white/90"
      >
        <span className={`w-1.5 h-1.5 rounded-full ${activeProfile ? 'bg-green-400' : 'bg-white/30'}`} />
        {activeProfile ? `ENV: ${activeProfile.name}` : 'No environment'}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg min-w-44 py-1">
            {profiles.length === 0 ? (
              <div className="px-3 py-2 text-xs text-gray-400">No profiles — add in Settings</div>
            ) : (
              profiles.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { onSwitch(p.id); setOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2 ${
                    p.isActive ? 'font-semibold text-brand-600' : 'text-gray-700'
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
}: {
  activeProfile: EnvProfile | null;
  profiles: EnvProfile[];
  onNavigate: (m: Module) => void;
  onSwitchProfile: (id: string) => void;
  onOpenSettings: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-brand-900 px-4 pt-4 pb-5">
        <div className="flex items-center justify-between mb-3">
          <span className="font-semibold text-white text-base tracking-tight">Developer Buddy</span>
          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded-lg hover:bg-brand-600 text-white/80 hover:text-white transition-colors"
            title="Settings"
          >
            <Settings size={16} />
          </button>
        </div>
        <EnvBadge
          activeProfile={activeProfile}
          profiles={profiles}
          onSwitch={onSwitchProfile}
        />
      </div>

      {/* Module buttons */}
      <div className="flex-1 overflow-auto p-3 flex flex-col gap-2">
        {MODULES.map((mod) => (
          <button
            key={mod.id}
            onClick={() => onNavigate(mod.id)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 bg-white hover:border-brand-400 hover:bg-brand-50 hover:shadow-sm text-left transition-all group"
          >
            <span className="text-brand-500 group-hover:text-brand-600 shrink-0">
              {mod.icon}
            </span>
            <div className="min-w-0">
              <div className="font-medium text-gray-900 text-sm">{mod.label}</div>
              <div className="text-xs text-gray-400 group-hover:text-gray-500">{mod.description}</div>
            </div>
          </button>
        ))}
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
    <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 bg-white shrink-0">
      <button
        onClick={onBack}
        className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors"
        title="Back"
      >
        <ArrowLeft size={16} />
      </button>
      <span className="font-semibold text-sm flex-1">{label}</span>
      <button
        onClick={onOpenSettings}
        className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
        title="Settings"
      >
        <Settings size={14} />
      </button>
    </div>
  );
}

export default function App() {
  const [activeModule, setActiveModule] = useState<Module | null>(null);
  const [activeProfile, setActiveProfile] = useState<EnvProfile | null>(null);
  const [profiles, setProfiles] = useState<EnvProfile[]>([]);

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
  }, [loadProfiles]);

  const handleSwitchProfile = async (id: string) => {
    await StorageService.setActiveProfile(id);
    loadProfiles();
  };

  const handleOpenSettings = () => {
    chrome.runtime.openOptionsPage();
  };

  const activeModuleDef = MODULES.find((m) => m.id === activeModule);

  if (!activeModule) {
    return (
      <HomeScreen
        activeProfile={activeProfile}
        profiles={profiles}
        onNavigate={setActiveModule}
        onSwitchProfile={handleSwitchProfile}
        onOpenSettings={handleOpenSettings}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white text-gray-900 text-sm overflow-hidden">
      <ModuleHeader
        label={activeModuleDef?.label ?? ''}
        onBack={() => setActiveModule(null)}
        onOpenSettings={handleOpenSettings}
      />
      <div className="flex-1 overflow-auto p-3">
        {activeModule === 'scripts'      && <ScriptList />}
        {activeModule === 'api'          && <ApiTester />}
        {activeModule === 'docs'         && <DocsList />}
        {activeModule === 'pr'           && <SelfService />}
        {activeModule === 'user-scripts' && <UserScriptPanel />}
      </div>
    </div>
  );
}
