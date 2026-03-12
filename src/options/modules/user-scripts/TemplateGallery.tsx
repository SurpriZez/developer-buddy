import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { SCRIPT_TEMPLATES, ScriptTemplate } from './templates';

interface Props {
  onUse: (body: string) => void;
  onCancel: () => void;
}

const CATEGORY_ORDER = ['GitHub', 'Productivity', 'Utilities'];

function groupByCategory(templates: ScriptTemplate[]): Record<string, ScriptTemplate[]> {
  return templates.reduce<Record<string, ScriptTemplate[]>>((acc, t) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  }, {});
}

export function TemplateGallery({ onUse, onCancel }: Props) {
  const grouped = groupByCategory(SCRIPT_TEMPLATES);
  const categories = CATEGORY_ORDER.filter((c) => grouped[c]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onCancel}
          className="p-1.5 rounded hover:bg-accent-container text-text-muted hover:text-text-primary transition-colors"
          title="Back"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h2 className="text-base font-semibold text-text-primary">Script Templates</h2>
          <p className="text-xs text-text-muted">Choose a template to get started quickly</p>
        </div>
      </div>

      {/* Categories */}
      {categories.map((category) => (
        <div key={category}>
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
            {category}
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {grouped[category].map((template) => (
              <div
                key={template.id}
                className="bg-surface border border-theme-border rounded-card p-4 space-y-3 flex flex-col"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold text-text-primary leading-tight">
                      {template.name}
                    </span>
                    <span className="shrink-0 text-xs bg-accent-container text-accent px-2 py-0.5 rounded-full font-medium">
                      {template.category}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed">
                    {template.description}
                  </p>
                </div>
                <button
                  onClick={() => onUse(template.body)}
                  className="w-full px-3 py-2 bg-accent text-[var(--color-bg-primary)] rounded-card text-xs font-semibold hover:opacity-90 transition-opacity"
                >
                  Use Template
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
