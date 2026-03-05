import React, { useEffect, useState, useMemo } from 'react';
import { Check } from 'lucide-react';
import {
  THEME_PRESETS,
  type ThemeConfig,
  loadThemeConfig,
  saveThemeConfig,
  getResolvedTokens,
  applyTheme,
} from '../design-system/themes';
import { logEvent } from '../lib/amplitude';
import './Settings.css';

const SETTINGS_STORAGE_KEY = 'travelplanner_settings';

type SettingsState = {
  compactLayout: boolean;
  textSize: number;
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
    if (!raw) return { compactLayout: false, textSize: 80 };
    const parsed = JSON.parse(raw) as Partial<SettingsState>;
    return { compactLayout: parsed.compactLayout ?? false, textSize: parsed.textSize ?? 80 };
  } catch {
    return { compactLayout: false, textSize: 80 };
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
    document.documentElement.style.setProperty('--text-size', `${settings.textSize}%`);
  }, [settings]);

  useEffect(() => {
    applyTheme(resolvedTokens);
    saveThemeConfig(themeConfig);
  }, [resolvedTokens, themeConfig]);

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
      <header className="page-header">
        <div>
          <h1>Settings</h1>
          <p>Customize your TravelPlanner experience.</p>
        </div>
      </header>

      <div className="card settings-section">
        <h2 className="section-heading">Theme</h2>
        <div className="preset-grid">
          {THEME_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`preset-card ${preset.id === themeConfig.presetId ? 'active' : ''}`}
              onClick={() => selectPreset(preset.id)}
            >
              <div className="preset-swatches">
                <span className="swatch" style={{ background: preset.preview.bg }} />
                <span className="swatch" style={{ background: preset.preview.primary }} />
                <span className="swatch" style={{ background: preset.preview.secondary }} />
                <span className="swatch" style={{ background: preset.preview.accent }} />
              </div>
              <span className="preset-name">{preset.name}</span>
              <span className="preset-desc">{preset.description}</span>
              {preset.id === themeConfig.presetId && (
                <span className="preset-check"><Check size={14} /></span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="card settings-section">
        <div className="section-heading-row">
          <h2 className="section-heading">Color palette</h2>
          {hasOverrides && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={resetColors}>
              Reset to preset
            </button>
          )}
        </div>
        <p className="section-hint">Override the {activePreset.name} theme colors.</p>
        <div className="theme-color-grid">
          {colorFields.map(({ key, label, value }) => (
            <div key={key} className="input-group">
              <label className="input-label">{label}</label>
              <div className="theme-color-row">
                <input
                  type="color"
                  value={value}
                  onChange={(e) => updateColor(key, e.target.value)}
                  className="theme-color-swatch"
                  aria-label={`${label} color`}
                />
                <input
                  type="text"
                  value={value}
                  onChange={(e) => updateColor(key, e.target.value)}
                  className="input-field theme-color-hex"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card settings-section">
        <h2 className="section-heading">Layout</h2>
        <div className="input-group">
          <label className="input-label" htmlFor="compact-layout-toggle">
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
        <div className="input-group" style={{ marginTop: '1rem' }}>
          <label className="input-label">Text size</label>
          <div className="text-size-options">
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
