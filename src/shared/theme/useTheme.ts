import { useState, useEffect } from 'react';

const THEME_KEY = 'developer_buddy_theme';
type Theme = 'dark' | 'blue';

// Call before root.render() to avoid flash
export async function bootstrapTheme(): Promise<void> {
  const result = await chrome.storage.local.get(THEME_KEY);
  const theme: Theme = (result[THEME_KEY] as Theme) ?? 'dark';
  document.documentElement.setAttribute('data-theme', theme);
}

// React hook — call in App component
export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    chrome.storage.local.get(THEME_KEY).then((r) => {
      const t = (r[THEME_KEY] as Theme) ?? 'dark';
      setTheme(t);
      document.documentElement.setAttribute('data-theme', t);
    });
  }, []);

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'blue' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    chrome.storage.local.set({ [THEME_KEY]: next });
  };

  return { theme, toggleTheme };
}
