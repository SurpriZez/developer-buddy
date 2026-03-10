import type { EnvProfile } from '../types';

export function interpolate(template: string, profile: EnvProfile | null): string {
  if (!profile) return template;

  return template.replace(/\{\{([^}]+)\}\}/g, (match, key: string) => {
    const variable = profile.variables.find((v) => v.key === key);
    return variable !== undefined ? variable.value : match;
  });
}
