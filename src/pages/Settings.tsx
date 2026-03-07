import React, { useEffect, useState, useMemo } from 'react';
import { Check, Sun, Moon } from 'lucide-react';
import {
  THEME_PRESETS,
  type ThemeConfig,
  loadThemeConfig,
  saveThemeConfig,
  getResolvedTokens,
  getDarkTokens,
  applyTheme,
} from '../design-system/themes';
import { logEvent } from '../lib/amplitude';

const SETTINGS_STORAGE_KEY = 'travelplanner_settings';

type SettingsState = {
  compactLayout: boolean;
  textSize: number;
  darkMode: boolean;
};

const TEXT_SIZE_OPTIONS = [
  { label: 'Small', value: 75 },
  { label: 'Default', value: 80 },
  { label: 'Medium', value: 90 },
  { label: 'Large', value: 100 },
  { label: 'Extra Large', value: 112 },
];

const loadSettings = (): SettingsState => {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { compactLayout: false, textSize: 80, darkMode: false };
    const parsed = JSON.parse(raw) as Partial<SettingsState>;
    return {
      compactLayout: parsed.compactLayout ?? false,
      textSize: parsed.textSize ?? 80,
      darkMode: parsed.darkMode ?? false,
    };
  } catch {
    return { compactLayout: false, textSize: 80, darkMode: false };
  }
};

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<SettingsState>(() => loadSettings());
  const [themeConfig, setThemeConfig] = useState<ThemeConfig>(() => loadThemeConfig());

  const resolvedTokens = useMemo(() => getResolvedTokens(themeConfig), [themeConfig]);
  const activePreset = THEME_PRESETS.find((p) => p.id === themeConfig.presetId) ?? THEME_PRESETS[0];

  useEffect(() => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    document.body.classList.toggle('compact-layout', settings.compactLayout);
    document.body.classList.toggle('dark-mode', settings.darkMode);
    document.documentElement.style.setProperty('color-scheme', settings.darkMode ? 'dark' : 'light');
    document.documentElement.style.setProperty('--text-size', `${settings.textSize}%`);

    const tokens = settings.darkMode
      ? getDarkTokens(getResolvedTokens(themeConfig))
      : getResolvedTokens(themeConfig);
    applyTheme(tokens);
    saveThemeConfig(themeConfig);
  }, [settings, themeConfig]);

  const selectPreset = (presetId: string) => {
    setThemeConfig({ presetId, colorOverrides: {} });
    logEvent('Theme Preset Selected', { preset: presetId });
  };

  const updateColor = (key: 'primaryColor' | 'secondaryColor' | 'accentColor', value: string) => {
    setThemeConfig((prev) => ({
      ...prev,
      colorOverrides: { ...prev.colorOverrides, [key]: value },
    }));
    logEvent('Theme Color Customized', { color_key: key, color_value: value });
  };

  const resetColors = () => {
    setThemeConfig((prev) => ({ ...prev, colorOverrides: {} }));
  };

  const hasOverrides = Object.values(themeConfig.colorOverrides).some(Boolean);

  const colorFields = [
    { key: 'primaryColor' as const, label: 'Primary', value: resolvedTokens.primaryColor },
    { key: 'secondaryColor' as const, label: 'Secondary', value: resolvedTokens.secondaryColor },
    { key: 'accentColor' as const, label: 'Accent', value: resolvedTokens.accentColor },
  ];

  return (
    <div className="page-container animate-fade-in">
      <style>{`
        .preset-card {
            position: relative; display: flex; flex-direction: column; align-items: center; gap: 0.4rem;
            padding: 1rem 0.75rem; border: 2px solid var(--border-color); border-radius: var(--radius-lg);
            background-color: var(--surface-color); cursor: pointer; transition: all 0.2s ease;
            font-family: inherit; text-align: center;
        }
        .preset-card:hover { border-color: var(--primary-color); transform: translateY(-2px); box-shadow: var(--shadow-md); }
        .preset-card.active { border-color: var(--primary-color); box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary-color) 15%, transparent); }
        
        .text-size-btn {
            padding: 0.35rem 0.85rem; border-radius: var(--radius-full); border: 1px solid var(--border-color);
            background-color: var(--surface-color); font-size: 0.8rem; font-family: inherit; cursor: pointer; transition: all 0.2s ease;
        }
        .text-size-btn:hover { border-color: var(--primary-color); }
        .text-size-btn.active { background-color: var(--primary-color); color: white; border-color: var(--primary-color); }

        .dark-mode-toggle {
            position: relative; width: 64px; height: 34px; border-radius: 17px; border: 2px solid var(--border-color);
            background-color: var(--border-light); cursor: pointer; transition: all 0.3s ease; flex-shrink: 0; padding: 0;
        }
        .dark-mode-toggle.active { background-color: var(--primary-color); border-color: var(--primary-color); }
        .toggle-thumb {
            position: absolute; top: 3px; left: 3px; width: 24px; height: 24px; border-radius: 50%;
            background-color: var(--surface-color); box-shadow: 0 1px 3px rgb(0 0 0 / 0.2); transition: transform 0.3s ease;
        }
        .dark-mode-toggle.active .toggle-thumb { transform: translateX(30px); }
        .toggle-icon { position: absolute; top: 50%; transform: translateY(-50%); display: flex; align-items: center; justify-content: center; transition: opacity 0.2s ease; }
        .toggle-sun { left: 7px; color: var(--accent-color); opacity: 1; }
        .toggle-moon { right: 7px; color: white; opacity: 0.4; }
        .dark-mode-toggle.active .toggle-sun { opacity: 0.4; }
        .dark-mode-toggle.active .toggle-moon { opacity: 1; }

        @media (max-width: 768px) {
            .mobile-preset-grid { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)) !important; }
        }
      `}</style>
      <header className="page-header">
        <div>
          <h1>Settings</h1>
          <p>Customize your TravelPlanner experience.</p>
        </div>
      </header>

      <div className="card p-lg mb-lg" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--primary-color) 5%, var(--surface-color)), color-mix(in srgb, var(--secondary-color) 5%, var(--surface-color)))' }}>
        <div className="flex justify-between items-center gap-md">
          <div>
            <h2 className="text-lg font-bold mb-xs">Appearance</h2>
            <p className="text-sm text-subtle m-0">{settings.darkMode ? 'Dark mode is on — easy on the eyes.' : 'Light mode is on — bright and clear.'}</p>
          </div>
          <button
            type="button"
            className={`dark-mode-toggle ${settings.darkMode ? 'active' : ''}`}
            onClick={() => {
              setSettings(prev => ({ ...prev, darkMode: !prev.darkMode }));
              logEvent('Dark Mode Toggled', { enabled: !settings.darkMode });
            }}
            aria-label={settings.darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <span className="toggle-icon toggle-sun"><Sun size={16} /></span>
            <span className="toggle-icon toggle-moon"><Moon size={16} /></span>
            <span className="toggle-thumb" />
          </button>
        </div>
      </div>

      <div className="card p-lg mb-lg">
        <h2 className="text-lg font-bold mb-md">Theme</h2>
        <div className="grid grid-cols-auto-140 gap-md mobile-preset-grid">
          {THEME_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`preset-card ${preset.id === themeConfig.presetId ? 'active' : ''}`}
              onClick={() => selectPreset(preset.id)}
            >
              <div className="flex gap-[4px] mb-[0.25rem]">
                <span style={{ width: '20px', height: '20px', borderRadius: '50%', border: '1px solid rgba(0, 0, 0, 0.08)', background: preset.preview.bg }} />
                <span style={{ width: '20px', height: '20px', borderRadius: '50%', border: '1px solid rgba(0, 0, 0, 0.08)', background: preset.preview.primary }} />
                <span style={{ width: '20px', height: '20px', borderRadius: '50%', border: '1px solid rgba(0, 0, 0, 0.08)', background: preset.preview.secondary }} />
                <span style={{ width: '20px', height: '20px', borderRadius: '50%', border: '1px solid rgba(0, 0, 0, 0.08)', background: preset.preview.accent }} />
              </div>
              <span className="font-semibold text-primary" style={{ fontSize: '0.85rem' }}>{preset.name}</span>
              <span className="text-tertiary" style={{ fontSize: '0.7rem' }}>{preset.description}</span>
              {preset.id === themeConfig.presetId && (
                <span className="absolute flex items-center justify-center bg-primary text-white" style={{ top: '0.5rem', right: '0.5rem', width: '20px', height: '20px', borderRadius: '50%' }}><Check size={14} /></span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="card p-lg mb-lg">
        <div className="flex justify-between items-center mb-xs">
          <h2 className="text-lg font-bold m-0">Color palette</h2>
          {hasOverrides && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={resetColors}>
              Reset to preset
            </button>
          )}
        </div>
        <p className="text-sm text-subtle mb-md">Override the {activePreset.name} theme colors.</p>
        <div className="grid grid-cols-auto-160 gap-md mb-md">
          {colorFields.map(({ key, label, value }) => (
            <div key={key} className="flex flex-col gap-[0.25rem]">
              <label className="text-xs text-tertiary uppercase font-semibold" style={{ letterSpacing: '0.04em' }}>{label}</label>
              <div className="flex items-center gap-sm">
                <input
                  type="color"
                  value={value}
                  onChange={(e) => updateColor(key, e.target.value)}
                  className="cursor-pointer"
                  style={{ width: '2.5rem', height: '2rem', padding: 0, border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', background: 'none' }}
                  aria-label={`${label} color`}
                />
                <input
                  type="text"
                  value={value}
                  onChange={(e) => updateColor(key, e.target.value)}
                  className="input-field flex-1 font-mono text-sm"
                  style={{ minWidth: 0 }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-lg mb-lg">
        <h2 className="text-lg font-bold mb-md">Layout</h2>
        <div className="flex flex-col gap-xs mb-md">
          <label className="text-sm font-medium text-primary" htmlFor="compact-layout-toggle">
            <input
              id="compact-layout-toggle"
              type="checkbox"
              checked={settings.compactLayout}
              onChange={(e) => {
                setSettings((prev) => ({ ...prev, compactLayout: e.target.checked }));
                logEvent('Compact Layout Toggled', { enabled: e.target.checked });
              }}
              style={{ marginRight: '0.5rem' }}
            />
            Compact layout
          </label>
          <p>
            Use tighter spacing to fit more information on screen.
          </p>
        </div>
        <div className="flex flex-col gap-xs" style={{ marginTop: '1rem' }}>
          <label className="text-sm font-medium text-primary">Text size</label>
          <div className="flex flex-wrap gap-sm">
            {TEXT_SIZE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`text-size-btn ${settings.textSize === opt.value ? 'active' : ''}`}
                onClick={() => {
                  setSettings((prev) => ({ ...prev, textSize: opt.value }));
                  logEvent('Text Size Changed', { size: opt.label, value: opt.value });
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
