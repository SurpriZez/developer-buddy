import React, { useState } from 'react';
import { Code2, CheckCircle2, User } from 'lucide-react';

type Step = 0 | 1 | 2;

const ROLES = ['Developer', 'DevOps', 'QA', 'Designer', 'Other'];

function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`rounded-full transition-all duration-300 ${
            i === step
              ? 'w-6 h-2 bg-accent'
              : i < step
              ? 'w-2 h-2 bg-accent opacity-50'
              : 'w-2 h-2 bg-accent-container'
          }`}
        />
      ))}
    </div>
  );
}

export default function App() {
  const [step, setStep] = useState<Step>(0);
  const [name, setName] = useState('');
  const [role, setRole] = useState('Developer');
  const [nameError, setNameError] = useState('');

  const handleNext = async () => {
    if (step === 1) {
      if (!name.trim()) {
        setNameError('Please enter your name.');
        return;
      }
      await chrome.storage.local.set({
        developer_buddy_user: { name: name.trim(), role, wizardCompleted: true },
      });
    }
    setStep((s) => (s + 1) as Step);
  };

  const handleBack = () => setStep((s) => (s - 1) as Step);

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-surface border border-theme-border rounded-card shadow-2xl p-8">
        <ProgressDots step={step} total={3} />

        {/* Step 0: Welcome */}
        {step === 0 && (
          <div className="text-center space-y-4">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-card bg-accent-container flex items-center justify-center">
                <Code2 size={32} className="text-accent" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-text-primary">Welcome to Developer Buddy</h1>
            <p className="text-text-secondary text-sm leading-relaxed">
              Your browser-native developer portal. Run scripts, test APIs, manage
              environment profiles, and automate pages — all from your browser.
            </p>
            <p className="text-text-muted text-xs">
              Let's take 30 seconds to set things up.
            </p>
            <button
              onClick={handleNext}
              className="mt-4 w-full px-6 py-3 bg-accent text-[var(--color-bg-primary)] rounded-card font-semibold hover:opacity-90 transition-opacity"
            >
              Get Started →
            </button>
          </div>
        )}

        {/* Step 1: About You */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="flex justify-center mb-2">
              <div className="w-12 h-12 rounded-card bg-accent-container flex items-center justify-center">
                <User size={24} className="text-accent" />
              </div>
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold text-text-primary">About You</h2>
              <p className="text-text-muted text-sm mt-1">Tell us a bit about yourself</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  Your name <span className="text-accent">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setNameError(''); }}
                  placeholder="e.g. Alex"
                  autoFocus
                  className="w-full border border-theme-border rounded-card px-3 py-2.5 bg-[var(--color-bg-primary)] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent text-sm"
                />
                {nameError && <p className="text-red-400 text-xs mt-1">{nameError}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  Your role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full border border-theme-border rounded-card px-3 py-2.5 bg-[var(--color-bg-primary)] text-text-primary focus:outline-none focus:border-accent text-sm"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleBack}
                className="px-4 py-2.5 text-text-muted hover:text-text-primary text-sm transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleNext}
                className="flex-1 px-6 py-2.5 bg-accent text-[var(--color-bg-primary)] rounded-card font-semibold hover:opacity-90 transition-opacity text-sm"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Done */}
        {step === 2 && (
          <div className="text-center space-y-4">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-card bg-accent-container flex items-center justify-center">
                <CheckCircle2 size={32} className="text-accent" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-text-primary">
              You're all set{name ? `, ${name}` : ''}! 🎉
            </h2>
            <p className="text-text-secondary text-sm leading-relaxed">
              Developer Buddy is ready to go. Click the extension icon in your toolbar
              to open the side panel and start exploring.
            </p>
            <div className="pt-2 space-y-2">
              <button
                onClick={() => window.close()}
                className="w-full px-6 py-3 bg-accent text-[var(--color-bg-primary)] rounded-card font-semibold hover:opacity-90 transition-opacity"
              >
                Open Developer Buddy
              </button>
              <button
                onClick={() => window.close()}
                className="w-full px-6 py-2 text-text-muted hover:text-text-primary text-sm transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
