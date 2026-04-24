import React, { useEffect, useState, useMemo } from 'react';
import { Check, Sun, Moon, Trash2, RotateCcw, Plus, X } from 'lucide-react';
import type { LintRule } from '../lib/types';
import {
  THEME_PRESETS,
  isDarkPreset,
  type ThemeConfig,
  loadThemeConfig,
  saveThemeConfig,
  getResolvedTokens,
  getDarkTokens,
  applyTheme,
  preloadPresetFonts,
} from '../design-system/themes';
import { useSettings, updateSettings, resetSettings, clearLocalDrafts, type AppSettings } from '../lib/settings';

const TEXT_SIZE_OPTIONS = [
  { label: 'Small', value: 85 },
  { label: 'Default', value: 100 },
  { label: 'Medium', value: 112 },
  { label: 'Large', value: 125 },
  { label: 'Extra Large', value: 140 },
];

const ZOOM_OPTIONS = [70, 80, 90, 100, 110, 120, 130, 140];

const HEADER_COLOR_OPTIONS: { value: AppSettings['headerRowColor']; label: string; preview?: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'primary', label: 'Primary', preview: 'var(--primary-color)' },
  { value: 'secondary', label: 'Secondary', preview: 'var(--secondary-color)' },
  { value: 'accent', label: 'Accent', preview: 'var(--accent-color)' },
  { value: 'slate', label: 'Slate', preview: 'var(--text-tertiary)' },
  { value: 'transparent', label: 'None' },
];

function SettingsToggle({ id, label, description, checked, onChange }: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-xs">
      <label className="text-sm font-medium text-primary" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          style={{ marginRight: '0.5rem' }}
        />
        {label}
      </label>
      {description && <p className="text-sm text-subtle m-0" style={{ paddingLeft: '1.5rem' }}>{description}</p>}
    </div>
  );
}

const LINT_CATEGORIES: { value: LintRule['category']; label: string }[] = [
  { value: 'hotel', label: 'Hotel' },
  { value: 'transport', label: 'Transport' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'activity', label: 'Activity' },
  { value: 'other', label: 'Other' },
];

function TravelRulesCard({ settings, set }: { settings: AppSettings; set: (patch: Partial<AppSettings>) => void }) {
  const [ruleText, setRuleText] = useState('');
  const [ruleSource, setRuleSource] = useState('');
  const [ruleCategory, setRuleCategory] = useState<LintRule['category']>('other');

  const rules = settings.travelLintRules ?? [];

  const addRule = () => {
    const trimmed = ruleText.trim();
    if (!trimmed) return;
    const next: LintRule = {
      id: Date.now().toString(),
      rule: trimmed,
      category: ruleCategory,
      ...(ruleSource.trim() && { source: ruleSource.trim() }),
    };
    set({ travelLintRules: [...rules, next] });
    setRuleText('');
    setRuleSource('');
    setRuleCategory('other');
  };

  const removeRule = (id: string) => {
    set({ travelLintRules: rules.filter(r => r.id !== id) });
  };

  return (
    <div className="card p-lg mb-lg">
      <h2 className="text-lg font-bold mb-xs">Travel Rules</h2>
      <p className="text-sm text-subtle mb-md m-0">
        Persistent guardrails injected into every AI call as hard constraints — your "never again" rules that survive across all trips.
      </p>

      {rules.length > 0 && (
        <div className="flex flex-col gap-2 mb-md">
          {rules.map((r) => (
            <div
              key={r.id}
              className="flex items-start gap-sm"
              style={{
                padding: '0.5rem 0.75rem',
                background: 'var(--surface-2, var(--border-light))',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
              }}
            >
              <span
                className="text-xs font-semibold shrink-0"
                style={{
                  padding: '2px 6px',
                  background: 'var(--primary-color)',
                  color: 'white',
                  borderRadius: 'var(--radius-full)',
                  marginTop: '1px',
                }}
              >
                {r.category}
              </span>
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-sm" style={{ wordBreak: 'break-word' }}>{r.rule}</span>
                {r.source && (
                  <span className="text-xs text-subtle" style={{ marginTop: '2px' }}>From: {r.source}</span>
                )}
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm shrink-0"
                style={{ padding: '2px', color: 'var(--text-tertiary)' }}
                onClick={() => removeRule(r.id)}
                aria-label="Remove rule"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-sm">
        <div className="flex flex-wrap gap-sm">
          <select
            className="input-field"
            style={{ flex: '0 0 auto', width: 'auto' }}
            value={ruleCategory}
            onChange={(e) => setRuleCategory(e.target.value as LintRule['category'])}
          >
            {LINT_CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <input
            type="text"
            className="input-field flex-1"
            style={{ minWidth: '180px' }}
            placeholder='e.g. No hotels with resort fees'
            value={ruleText}
            onChange={(e) => setRuleText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addRule(); }}
          />
        </div>
        <div className="flex gap-sm">
          <input
            type="text"
            className="input-field flex-1"
            placeholder='Source (optional) — e.g. Bad hotel in Bali 2024'
            value={ruleSource}
            onChange={(e) => setRuleSource(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addRule(); }}
          />
          <button
            type="button"
            className="btn btn-primary btn-sm shrink-0"
            onClick={addRule}
            disabled={!ruleText.trim()}
          >
            <Plus size={14} /> Add rule
          </button>
        </div>
      </div>
    </div>
  );
}

const Settings: React.FC = () => {
  const settings = useSettings();
  const [themeConfig, setThemeConfig] = useState<ThemeConfig>(() => loadThemeConfig());

  const resolvedTokens = useMemo(() => getResolvedTokens(themeConfig), [themeConfig]);
  const activePreset = THEME_PRESETS.find((p) => p.id === themeConfig.presetId) ?? THEME_PRESETS[0];

  useEffect(() => {
    preloadPresetFonts();
  }, []);

  useEffect(() => {
    document.body.classList.toggle('compact-layout', settings.compactLayout);
    const useDarkPreset = isDarkPreset(themeConfig.presetId);
    const effectiveDark = settings.darkMode || useDarkPreset;
    document.body.classList.toggle('dark-mode', effectiveDark);
    document.body.classList.toggle('theme-dark-preset', useDarkPreset);
    document.documentElement.style.setProperty('color-scheme', effectiveDark ? 'dark' : 'light');
    document.documentElement.style.setProperty('--text-size', `${settings.textSize}%`);

    const tokens = useDarkPreset
      ? getResolvedTokens(themeConfig)
      : effectiveDark
        ? getDarkTokens(getResolvedTokens(themeConfig))
        : getResolvedTokens(themeConfig);
    applyTheme(tokens);
    saveThemeConfig(themeConfig);
  }, [settings.compactLayout, settings.darkMode, settings.textSize, themeConfig]);

  const set = (patch: Parameters<typeof updateSettings>[0]) => {
    updateSettings(patch);
  };

  const selectPreset = (presetId: string) => {
    setThemeConfig({ presetId, colorOverrides: {} });
  };

  const updateColor = (key: 'primaryColor' | 'secondaryColor' | 'accentColor', value: string) => {
    setThemeConfig((prev) => ({
      ...prev,
      colorOverrides: { ...prev.colorOverrides, [key]: value },
    }));
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
        
        .text-size-btn, .zoom-btn {
            padding: 0.35rem 0.85rem; border-radius: var(--radius-full); border: 1px solid var(--border-color);
            background-color: var(--surface-color); font-size: 0.8rem; font-family: inherit; cursor: pointer; transition: all 0.2s ease;
        }
        .text-size-btn:hover, .zoom-btn:hover { border-color: var(--primary-color); }
        .text-size-btn.active, .zoom-btn.active { background-color: var(--primary-color); color: white; border-color: var(--primary-color); }

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

        .settings-section-title { font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-tertiary); margin-bottom: 0.75rem; }

        @media (max-width: 768px) {
            .mobile-preset-grid { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)) !important; }
        }
      `}</style>
      <header className="page-header">
        <div>
          <h1>Settings</h1>
          <p>Customize your TravelPlanner experience. Settings sync across devices when signed in.</p>
        </div>
      </header>

      {/* Appearance — dark mode toggle hidden for Discord, Neon, Midnight (always dark) */}
      <div className="card p-lg mb-lg" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--primary-color) 5%, var(--surface-color)), color-mix(in srgb, var(--secondary-color) 5%, var(--surface-color)))' }}>
        <div className="flex justify-between items-center gap-md">
          <div>
            <h2 className="text-lg font-bold mb-xs">Appearance</h2>
            <p className="text-sm text-subtle m-0">
              {isDarkPreset(themeConfig.presetId) ? 'This theme is always dark — no toggle.' : settings.darkMode ? 'Dark mode is on — easy on the eyes.' : 'Light mode is on — bright and clear.'}
            </p>
          </div>
          {!isDarkPreset(themeConfig.presetId) && (
            <button
              type="button"
              className={`dark-mode-toggle ${settings.darkMode ? 'active' : ''}`}
              onClick={() => {
                set({ darkMode: !settings.darkMode });
              }}
              aria-label={settings.darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <span className="toggle-icon toggle-sun"><Sun size={16} /></span>
              <span className="toggle-icon toggle-moon"><Moon size={16} /></span>
              <span className="toggle-thumb" />
            </button>
          )}
        </div>
      </div>

      {/* Theme — light and dark presets separated */}
      <div className="card p-lg mb-lg">
        <h2 className="text-lg font-bold mb-md">Theme</h2>
        <p className="settings-section-title m-0 mb-sm">Themes</p>
        <div className="grid grid-cols-auto-140 gap-md mobile-preset-grid mb-lg">
          {THEME_PRESETS.filter((p) => !isDarkPreset(p.id)).map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`preset-card ${preset.id === themeConfig.presetId ? 'active' : ''}`}
              onClick={() => selectPreset(preset.id)}
              style={{ fontFamily: preset.tokens.fontFamily }}
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
        <p className="settings-section-title m-0 mb-sm">Dark themes</p>
        <div className="grid grid-cols-auto-140 gap-md mobile-preset-grid">
          {THEME_PRESETS.filter((p) => isDarkPreset(p.id)).map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`preset-card ${preset.id === themeConfig.presetId ? 'active' : ''}`}
              onClick={() => selectPreset(preset.id)}
              style={{ fontFamily: preset.tokens.fontFamily }}
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

      {/* Color palette */}
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

      {/* Layout */}
      <div className="card p-lg mb-lg">
        <h2 className="text-lg font-bold mb-md">Layout</h2>
        <div className="flex flex-col gap-md">
          <SettingsToggle
            id="compact-layout"
            label="Compact layout"
            description="Use tighter spacing to fit more information on screen."
            checked={settings.compactLayout}
            onChange={(v) => { set({ compactLayout: v }); }}
          />
          <div className="flex flex-col gap-xs" style={{ marginTop: '0.5rem' }}>
            <label className="text-sm font-medium text-primary">Text size</label>
            <div className="flex flex-wrap gap-sm">
              {TEXT_SIZE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`text-size-btn ${settings.textSize === opt.value ? 'active' : ''}`}
                  onClick={() => { set({ textSize: opt.value }); }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Weather */}
      <div className="card p-lg mb-lg">
        <h2 className="text-lg font-bold mb-md">Weather</h2>
        <div className="flex flex-col gap-md">
          <div className="flex flex-col gap-xs">
            <label className="text-sm font-medium text-primary">Temperature unit</label>
            <div className="flex gap-0" style={{ borderRadius: 'var(--radius-full)', border: '1px solid var(--border-color)', width: 'fit-content', overflow: 'hidden' }}>
              {(['C', 'F'] as const).map((unit) => (
                <button
                  key={unit}
                  type="button"
                  className={`text-size-btn ${settings.temperatureUnit === unit ? 'active' : ''}`}
                  style={{ borderRadius: 0, margin: 0 }}
                  onClick={() => { set({ temperatureUnit: unit }); }}
                >
                  °{unit}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-xs">
            <label className="text-sm font-medium text-primary">Hourly forecast time range</label>
            <p className="text-sm text-subtle m-0">Show only these hours on the Weather page (e.g. 9am–9pm).</p>
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-sm text-subtle">From</label>
              <select
                value={settings.hourlyForecastStartHour ?? 9}
                onChange={(e) => { set({ hourlyForecastStartHour: Number(e.target.value) }); }}
                className="input-field"
                style={{ width: '5rem' }}
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{i === 0 ? '12am' : i < 12 ? `${i}am` : i === 12 ? '12pm' : `${i - 12}pm`}</option>
                ))}
              </select>
              <span className="text-sm text-subtle">to</span>
              <select
                value={settings.hourlyForecastEndHour ?? 21}
                onChange={(e) => { set({ hourlyForecastEndHour: Number(e.target.value) }); }}
                className="input-field"
                style={{ width: '5rem' }}
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{i === 0 ? '12am' : i < 12 ? `${i}am` : i === 12 ? '12pm' : `${i - 12}pm`}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Spreadsheet */}
      <div className="card p-lg mb-lg">
        <h2 className="text-lg font-bold mb-md">Spreadsheet</h2>
        <div className="flex flex-col gap-md">
          <SettingsToggle
            id="color-coded-rows"
            label="Color-coded time rows"
            description="Apply the morning/afternoon/evening tint across the entire spreadsheet row, not just the label."
            checked={settings.colorCodedTimeRows}
            onChange={(v) => { set({ colorCodedTimeRows: v }); }}
          />
          {settings.colorCodedTimeRows && (
            <div className="flex flex-col gap-xs" style={{ paddingLeft: '1.5rem' }}>
              <label className="text-sm font-medium text-primary">
                Row tint opacity — {settings.colorCodingOpacity}%
              </label>
              <input
                type="range"
                min={1}
                max={20}
                step={1}
                value={settings.colorCodingOpacity}
                onChange={(e) => set({ colorCodingOpacity: Number(e.target.value) })}
                style={{ maxWidth: '220px', accentColor: 'var(--primary-color)' }}
              />
            </div>
          )}
          <div className="flex flex-col gap-xs">
            <label className="text-sm font-medium text-primary">Day header row color</label>
            <p className="text-sm text-subtle m-0">Tint the day column headers to distinguish them from the grid.</p>
            <div className="flex flex-wrap gap-sm" style={{ marginTop: '0.25rem' }}>
              {HEADER_COLOR_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`zoom-btn ${settings.headerRowColor === opt.value ? 'active' : ''}`}
                  onClick={() => { set({ headerRowColor: opt.value }); }}
                  style={opt.preview ? { borderLeft: `3px solid ${opt.preview}` } : undefined}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <SettingsToggle
            id="show-unscheduled"
            label="Show unscheduled section"
            description="Show the collapsible unscheduled activities section below the spreadsheet grid."
            checked={settings.showUnscheduledSection}
            onChange={(v) => { set({ showUnscheduledSection: v }); }}
          />
          <div className="flex flex-col gap-xs" style={{ marginTop: '0.25rem' }}>
            <label className="text-sm font-medium text-primary">Default zoom level</label>
            <div className="flex flex-wrap gap-sm">
              {ZOOM_OPTIONS.map((z) => (
                <button
                  key={z}
                  type="button"
                  className={`zoom-btn ${settings.defaultSpreadsheetZoom === z ? 'active' : ''}`}
                  onClick={() => { set({ defaultSpreadsheetZoom: z }); }}
                >
                  {z}%
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div className="card p-lg mb-lg">
        <h2 className="text-lg font-bold mb-md">Calendar</h2>
        <div className="flex flex-col gap-md">
          <div className="flex flex-col gap-xs">
            <label className="text-sm font-medium text-primary">Default view</label>
            <div className="flex gap-sm">
              {(['trip', 'day'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`text-size-btn ${settings.defaultCalendarView === v ? 'active' : ''}`}
                  onClick={() => { set({ defaultCalendarView: v }); }}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <SettingsToggle
            id="show-accommodation-cards"
            label="Show accommodation on trip cards"
            description="Display the accommodation row on calendar trip grid cards."
            checked={settings.showAccommodationOnTripCards}
            onChange={(v) => { set({ showAccommodationOnTripCards: v }); }}
          />
        </div>
      </div>

      {/* Planning */}
      <div className="card p-lg mb-lg">
        <h2 className="text-lg font-bold mb-md">Planning</h2>
        <div className="flex flex-col gap-md">
          <SettingsToggle
            id="show-planning-checks"
            label="Show planning checks"
            description="Display issue badges and conflict details on day pills."
            checked={settings.showPlanningChecks}
            onChange={(v) => { set({ showPlanningChecks: v }); }}
          />
          <SettingsToggle
            id="show-budget-warnings"
            label="Show budget warnings"
            description="Display budget threshold alerts on the Budget page."
            checked={settings.showBudgetWarnings}
            onChange={(v) => { set({ showBudgetWarnings: v }); }}
          />
        </div>
      </div>

      {/* AI Assistant */}
      <div className="card p-lg mb-lg">
        <h2 className="text-lg font-bold mb-md">AI Assistant</h2>
        <div className="flex flex-col gap-md">
          <div className="flex flex-col gap-xs">
            <label className="text-sm font-medium text-primary">Pace</label>
            <div className="flex flex-wrap gap-sm">
              {(['relaxed', 'balanced', 'fast'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`text-size-btn ${settings.aiDefaultPace === v ? 'active' : ''}`}
                  onClick={() => { set({ aiDefaultPace: v }); }}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-xs">
            <label className="text-sm font-medium text-primary">Budget tier</label>
            <div className="flex flex-wrap gap-sm">
              {(['budget', 'mid-range', 'luxury'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`text-size-btn ${settings.aiDefaultBudget === v ? 'active' : ''}`}
                  onClick={() => { set({ aiDefaultBudget: v }); }}
                >
                  {v === 'mid-range' ? 'Mid-range' : v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-xs">
            <label className="text-sm font-medium text-primary">Traveling as</label>
            <div className="flex flex-wrap gap-sm">
              {(['solo', 'couple', 'family', 'group'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`text-size-btn ${settings.aiDefaultGroupType === v ? 'active' : ''}`}
                  onClick={() => { set({ aiDefaultGroupType: v }); }}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-xs">
            <label className="text-sm font-medium text-primary">Interests</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. history, food, nature, art"
              value={settings.aiDefaultInterests}
              onChange={(e) => { set({ aiDefaultInterests: e.target.value }); }}
            />
          </div>
          <div className="flex flex-col gap-xs">
            <label className="text-sm font-medium text-primary">Transport preference</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. walking, public transit, taxi"
              value={settings.aiDefaultTransportPreference}
              onChange={(e) => { set({ aiDefaultTransportPreference: e.target.value }); }}
            />
          </div>
          <p className="text-sm text-subtle m-0">These are default preferences for the AI assistant. Individual trips can override these from the Assistant page.</p>
        </div>
      </div>

      {/* Travel Rules */}
      <TravelRulesCard settings={settings} set={set} />

      {/* Data */}
      <div className="card p-lg mb-lg">
        <h2 className="text-lg font-bold mb-md">Data</h2>
        <div className="flex flex-col gap-md">
          <div className="flex flex-col gap-xs">
            <div className="flex items-center gap-sm">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  if (window.confirm('Delete all local what-if drafts? This cannot be undone.')) {
                    void (async () => {
                      await clearLocalDrafts();
                    })();
                  }
                }}
              >
                <Trash2 size={14} /> Clear local drafts
              </button>
            </div>
            <p className="text-sm text-subtle m-0" style={{ paddingLeft: '0.25rem' }}>Remove all what-if scenario snapshots stored in your browser (IndexedDB).</p>
          </div>
          <div className="flex flex-col gap-xs">
            <div className="flex items-center gap-sm">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  if (window.confirm('Reset all settings to defaults? Your theme selection will be kept.')) {
                    resetSettings();
                  }
                }}
              >
                <RotateCcw size={14} /> Reset all settings
              </button>
            </div>
            <p className="text-sm text-subtle m-0" style={{ paddingLeft: '0.25rem' }}>Restore all settings to their default values.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
