import React, { useEffect, useState } from 'react';
import './Settings.css';

const SETTINGS_STORAGE_KEY = 'tripplanner_settings';
const THEME_STORAGE_KEY = 'tripplanner_theme';

const DEFAULT_THEME = {
  primary: '#3b82f6',
  primaryHover: '#2563eb',
  secondary: '#10b981',
  secondaryHover: '#059669',
  accent: '#f59e0b',
  accentHover: '#d97706',
};

type ThemeColors = typeof DEFAULT_THEME;

type SettingsState = {
  compactLayout: boolean;
};

function loadTheme(): Partial<ThemeColors> {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<ThemeColors>;
  } catch {
    return {};
  }
}

function applyTheme(theme: Partial<ThemeColors>) {
  const root = document.documentElement;
  if (theme.primary != null) root.style.setProperty('--primary-color', theme.primary);
  if (theme.primaryHover != null) root.style.setProperty('--primary-hover', theme.primaryHover);
  if (theme.secondary != null) root.style.setProperty('--secondary-color', theme.secondary);
  if (theme.secondaryHover != null) root.style.setProperty('--secondary-hover', theme.secondaryHover);
  if (theme.accent != null) root.style.setProperty('--accent-color', theme.accent);
  if (theme.accentHover != null) root.style.setProperty('--accent-hover', theme.accentHover);
}

const loadSettings = (): SettingsState => {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { compactLayout: false };
    const parsed = JSON.parse(raw) as Partial<SettingsState>;
    return {
      compactLayout: parsed.compactLayout ?? false,
    };
  } catch {
    return { compactLayout: false };
  }
};

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<SettingsState>(() => loadSettings());
  const [theme, setTheme] = useState<ThemeColors>(() => ({ ...DEFAULT_THEME, ...loadTheme() }));

  useEffect(() => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    document.body.classList.toggle('compact-layout', settings.compactLayout);
  }, [settings]);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
  }, [theme]);

  const updateTheme = (key: keyof ThemeColors, value: string) => {
    setTheme((prev) => ({ ...prev, [key]: value }));
  };

  const resetTheme = () => {
    setTheme({ ...DEFAULT_THEME });
  };

  return (
    <div className="page-container animate-fade-in">
      <header className="page-header">
        <div>
          <h1>Settings</h1>
          <p>Adjust TripPlanner preferences for your device.</p>
        </div>
      </header>

      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Theme colors</h2>
        <div className="theme-color-grid">
          {(['primary', 'secondary', 'accent'] as const).map((key) => (
            <div key={key} className="input-group">
              <label className="input-label">{key.charAt(0).toUpperCase() + key.slice(1)}</label>
              <div className="theme-color-row">
                <input
                  type="color"
                  value={theme[key]}
                  onChange={(e) => updateTheme(key, e.target.value)}
                  className="theme-color-swatch"
                  aria-label={`${key} color`}
                />
                <input
                  type="text"
                  value={theme[key]}
                  onChange={(e) => updateTheme(key, e.target.value)}
                  className="input-field theme-color-hex"
                />
              </div>
            </div>
          ))}
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={resetTheme}>
          Reset to default
        </button>
      </div>

      <div className="card" style={{ padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Layout</h2>
        <div className="input-group">
          <label className="input-label" htmlFor="compact-layout-toggle">
            <input
              id="compact-layout-toggle"
              type="checkbox"
              checked={settings.compactLayout}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, compactLayout: e.target.checked }))
              }
              style={{ marginRight: '0.5rem' }}
            />
            Compact layout
          </label>
          <p>
            Use slightly tighter spacing and paddings to fit more information on screen.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Settings;

