// Purpose: React context + provider for the Sakura Mist theme system — manages preset selection, CSS variable application, and dark mode.

import { createContext, useContext, useEffect, useMemo, useState, type ReactElement, type ReactNode } from 'react';
import {
  loadThemeConfig,
  saveThemeConfig,
  getResolvedTokens,
  getDarkTokens,
  applyTheme,
  THEME_PRESETS,
  isDarkPreset,
} from '../design-system/themes';
import { useSettings } from '../lib/settings';

interface ThemeContextValue {
  theme: string;
  setTheme: (themeId: string) => void;
  availableThemes: ReadonlyArray<{ id: string; name: string; description: string }>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Wrapping the app root with <ThemeProvider> replaces the manual useEffect in
 * App.tsx that calls loadThemeConfig / getResolvedTokens / applyTheme on mount.
 * Once this provider is wired in, that useEffect should be removed.
 */
export function ThemeProvider({ children }: { children: ReactNode }): ReactElement {
  const [theme, setThemeState] = useState<string>(() => loadThemeConfig().presetId);
  const settings = useSettings();

  useEffect(() => {
    const config = { presetId: theme, colorOverrides: {} };
    saveThemeConfig(config);

    let tokens = getResolvedTokens(config);
    const dark = isDarkPreset(theme);

    if (dark) {
      tokens = getDarkTokens(tokens);
      document.documentElement.style.colorScheme = 'dark';
      document.body.classList.add('dark');
    } else {
      document.documentElement.style.colorScheme = 'light';
      document.body.classList.remove('dark');
    }

    applyTheme(tokens);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty('--text-size', `${settings.textSize}%`);
  }, [settings.textSize]);

  useEffect(() => {
    document.body.classList.toggle('compact-layout', settings.compactLayout);
  }, [settings.compactLayout]);

  const setTheme = (themeId: string): void => {
    setThemeState(themeId);
  };

  const availableThemes = useMemo(
    () => THEME_PRESETS.map((p) => ({ id: p.id, name: p.name, description: p.description })),
    [],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, availableThemes }),
    [theme, availableThemes],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a <ThemeProvider>');
  }
  return ctx;
}
