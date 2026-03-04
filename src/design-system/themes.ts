export interface ThemeTokens {
  bgColor: string;
  surfaceColor: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  primaryColor: string;
  primaryHover: string;
  secondaryColor: string;
  secondaryHover: string;
  accentColor: string;
  accentHover: string;
  errorColor: string;
  errorBg: string;
  borderColor: string;
  borderLight: string;
  glassBg: string;
  glassBorder: string;
  shadowSm: string;
  shadowMd: string;
  shadowLg: string;
  radiusSm: string;
  radiusMd: string;
  radiusLg: string;
  radiusXl: string;
  radiusFull: string;
  fontFamily: string;
  fontUrl?: string;
}

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  preview: { primary: string; secondary: string; accent: string; bg: string };
  tokens: ThemeTokens;
}

export interface ThemeConfig {
  presetId: string;
  colorOverrides: Partial<{
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
  }>;
}

const TOKEN_TO_CSS: Record<keyof ThemeTokens, string> = {
  bgColor: '--bg-color',
  surfaceColor: '--surface-color',
  textPrimary: '--text-primary',
  textSecondary: '--text-secondary',
  textTertiary: '--text-tertiary',
  primaryColor: '--primary-color',
  primaryHover: '--primary-hover',
  secondaryColor: '--secondary-color',
  secondaryHover: '--secondary-hover',
  accentColor: '--accent-color',
  accentHover: '--accent-hover',
  errorColor: '--error-color',
  errorBg: '--error-bg',
  borderColor: '--border-color',
  borderLight: '--border-light',
  glassBg: '--glass-bg',
  glassBorder: '--glass-border',
  shadowSm: '--shadow-sm',
  shadowMd: '--shadow-md',
  shadowLg: '--shadow-lg',
  radiusSm: '--radius-sm',
  radiusMd: '--radius-md',
  radiusLg: '--radius-lg',
  radiusXl: '--radius-xl',
  radiusFull: '--radius-full',
  fontFamily: '--font-family',
  fontUrl: '',
};

function darkenHex(hex: string, amount = 0.15): string {
  const c = hex.replace('#', '');
  const num = parseInt(c, 16);
  const r = Math.max(0, Math.round(((num >> 16) & 0xff) * (1 - amount)));
  const g = Math.max(0, Math.round(((num >> 8) & 0xff) * (1 - amount)));
  const b = Math.max(0, Math.round((num & 0xff) * (1 - amount)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

const modern: ThemePreset = {
  id: 'modern',
  name: 'Modern',
  description: 'Clean and professional',
  preview: { primary: '#3b82f6', secondary: '#10b981', accent: '#f59e0b', bg: '#f8fafc' },
  tokens: {
    bgColor: '#f8fafc',
    surfaceColor: '#ffffff',
    textPrimary: '#0f172a',
    textSecondary: '#64748b',
    textTertiary: '#94a3b8',
    primaryColor: '#3b82f6',
    primaryHover: '#2563eb',
    secondaryColor: '#10b981',
    secondaryHover: '#059669',
    accentColor: '#f59e0b',
    accentHover: '#d97706',
    errorColor: '#ef4444',
    errorBg: '#fee2e2',
    borderColor: '#e2e8f0',
    borderLight: '#f1f5f9',
    glassBg: 'rgba(255, 255, 255, 0.7)',
    glassBorder: 'rgba(255, 255, 255, 0.3)',
    shadowSm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    shadowMd: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    shadowLg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    radiusSm: '0.375rem',
    radiusMd: '0.5rem',
    radiusLg: '1rem',
    radiusXl: '1.5rem',
    radiusFull: '9999px',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  },
};

const y2kRetro: ThemePreset = {
  id: 'y2k-retro',
  name: 'Y2K Retro',
  description: 'Bubbly, bold, and nostalgic',
  preview: { primary: '#ff1493', secondary: '#00c8ff', accent: '#bfff00', bg: '#fef0f8' },
  tokens: {
    bgColor: '#fef0f8',
    surfaceColor: '#ffffff',
    textPrimary: '#2d0a4e',
    textSecondary: '#6b4f7a',
    textTertiary: '#9f8baa',
    primaryColor: '#ff1493',
    primaryHover: '#d4007a',
    secondaryColor: '#00c8ff',
    secondaryHover: '#00a0d4',
    accentColor: '#bfff00',
    accentHover: '#99cc00',
    errorColor: '#ff3030',
    errorBg: '#ffe0e0',
    borderColor: '#f0c4e6',
    borderLight: '#fce8f4',
    glassBg: 'rgba(255, 240, 248, 0.75)',
    glassBorder: 'rgba(255, 200, 230, 0.4)',
    shadowSm: '0 2px 4px rgb(255 20 147 / 0.08)',
    shadowMd: '0 4px 12px rgb(255 20 147 / 0.12), 0 2px 4px rgb(0 200 255 / 0.08)',
    shadowLg: '0 8px 24px rgb(255 20 147 / 0.16), 0 4px 8px rgb(0 200 255 / 0.08)',
    radiusSm: '0.5rem',
    radiusMd: '0.75rem',
    radiusLg: '1.25rem',
    radiusXl: '2rem',
    radiusFull: '9999px',
    fontFamily: "'Space Grotesk', 'Inter', -apple-system, sans-serif",
    fontUrl: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap',
  },
};

const dark: ThemePreset = {
  id: 'dark',
  name: 'Dark',
  description: 'Easy on the eyes',
  preview: { primary: '#60a5fa', secondary: '#34d399', accent: '#fbbf24', bg: '#0f172a' },
  tokens: {
    bgColor: '#0f172a',
    surfaceColor: '#1e293b',
    textPrimary: '#f1f5f9',
    textSecondary: '#94a3b8',
    textTertiary: '#64748b',
    primaryColor: '#60a5fa',
    primaryHover: '#3b82f6',
    secondaryColor: '#34d399',
    secondaryHover: '#10b981',
    accentColor: '#fbbf24',
    accentHover: '#f59e0b',
    errorColor: '#f87171',
    errorBg: '#450a0a',
    borderColor: '#334155',
    borderLight: '#1e293b',
    glassBg: 'rgba(30, 41, 59, 0.75)',
    glassBorder: 'rgba(51, 65, 85, 0.4)',
    shadowSm: '0 1px 2px 0 rgb(0 0 0 / 0.3)',
    shadowMd: '0 4px 6px -1px rgb(0 0 0 / 0.4), 0 2px 4px -2px rgb(0 0 0 / 0.3)',
    shadowLg: '0 10px 15px -3px rgb(0 0 0 / 0.5), 0 4px 6px -4px rgb(0 0 0 / 0.4)',
    radiusSm: '0.375rem',
    radiusMd: '0.5rem',
    radiusLg: '1rem',
    radiusXl: '1.5rem',
    radiusFull: '9999px',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  },
};

const sunset: ThemePreset = {
  id: 'sunset',
  name: 'Sunset',
  description: 'Warm golden tones',
  preview: { primary: '#ea580c', secondary: '#a855f7', accent: '#eab308', bg: '#fffbeb' },
  tokens: {
    bgColor: '#fffbeb',
    surfaceColor: '#ffffff',
    textPrimary: '#431407',
    textSecondary: '#78350f',
    textTertiary: '#a16207',
    primaryColor: '#ea580c',
    primaryHover: '#c2410c',
    secondaryColor: '#a855f7',
    secondaryHover: '#9333ea',
    accentColor: '#eab308',
    accentHover: '#ca8a04',
    errorColor: '#dc2626',
    errorBg: '#fee2e2',
    borderColor: '#fed7aa',
    borderLight: '#fff7ed',
    glassBg: 'rgba(255, 251, 235, 0.75)',
    glassBorder: 'rgba(254, 215, 170, 0.4)',
    shadowSm: '0 1px 2px 0 rgb(234 88 12 / 0.06)',
    shadowMd: '0 4px 6px -1px rgb(234 88 12 / 0.1), 0 2px 4px -2px rgb(168 85 247 / 0.06)',
    shadowLg: '0 10px 15px -3px rgb(234 88 12 / 0.12), 0 4px 6px -4px rgb(168 85 247 / 0.08)',
    radiusSm: '0.375rem',
    radiusMd: '0.5rem',
    radiusLg: '1rem',
    radiusXl: '1.5rem',
    radiusFull: '9999px',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  },
};

const ocean: ThemePreset = {
  id: 'ocean',
  name: 'Ocean',
  description: 'Cool and calming',
  preview: { primary: '#0d9488', secondary: '#2563eb', accent: '#f59e0b', bg: '#f0fdfa' },
  tokens: {
    bgColor: '#f0fdfa',
    surfaceColor: '#ffffff',
    textPrimary: '#134e4a',
    textSecondary: '#4a7c7a',
    textTertiary: '#7da8a6',
    primaryColor: '#0d9488',
    primaryHover: '#0f766e',
    secondaryColor: '#2563eb',
    secondaryHover: '#1d4ed8',
    accentColor: '#f59e0b',
    accentHover: '#d97706',
    errorColor: '#ef4444',
    errorBg: '#fee2e2',
    borderColor: '#ccfbf1',
    borderLight: '#f0fdfa',
    glassBg: 'rgba(240, 253, 250, 0.75)',
    glassBorder: 'rgba(204, 251, 241, 0.4)',
    shadowSm: '0 1px 2px 0 rgb(13 148 136 / 0.06)',
    shadowMd: '0 4px 6px -1px rgb(13 148 136 / 0.1), 0 2px 4px -2px rgb(37 99 235 / 0.06)',
    shadowLg: '0 10px 15px -3px rgb(13 148 136 / 0.12), 0 4px 6px -4px rgb(37 99 235 / 0.08)',
    radiusSm: '0.375rem',
    radiusMd: '0.625rem',
    radiusLg: '1rem',
    radiusXl: '1.5rem',
    radiusFull: '9999px',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  },
};

export const THEME_PRESETS: ThemePreset[] = [modern, y2kRetro, dark, sunset, ocean];

const THEME_CONFIG_KEY = 'travelplanner_theme_config';
const LEGACY_THEME_KEY = 'travelplanner_theme';

export function loadThemeConfig(): ThemeConfig {
  try {
    const raw = localStorage.getItem(THEME_CONFIG_KEY);
    if (raw) return JSON.parse(raw) as ThemeConfig;

    const legacy = localStorage.getItem(LEGACY_THEME_KEY);
    if (legacy) {
      const p = JSON.parse(legacy) as Record<string, string>;
      return {
        presetId: 'modern',
        colorOverrides: {
          primaryColor: p.primary,
          secondaryColor: p.secondary,
          accentColor: p.accent,
        },
      };
    }
  } catch { /* ignore corrupt storage */ }
  return { presetId: 'modern', colorOverrides: {} };
}

export function saveThemeConfig(config: ThemeConfig): void {
  localStorage.setItem(THEME_CONFIG_KEY, JSON.stringify(config));
}

export function getResolvedTokens(config: ThemeConfig): ThemeTokens {
  const preset = THEME_PRESETS.find((p) => p.id === config.presetId) ?? THEME_PRESETS[0];
  const tokens = { ...preset.tokens };

  if (config.colorOverrides.primaryColor) {
    tokens.primaryColor = config.colorOverrides.primaryColor;
    tokens.primaryHover = darkenHex(config.colorOverrides.primaryColor);
  }
  if (config.colorOverrides.secondaryColor) {
    tokens.secondaryColor = config.colorOverrides.secondaryColor;
    tokens.secondaryHover = darkenHex(config.colorOverrides.secondaryColor);
  }
  if (config.colorOverrides.accentColor) {
    tokens.accentColor = config.colorOverrides.accentColor;
    tokens.accentHover = darkenHex(config.colorOverrides.accentColor);
  }

  return tokens;
}

export function applyTheme(tokens: ThemeTokens): void {
  const root = document.documentElement;

  for (const [key, cssVar] of Object.entries(TOKEN_TO_CSS)) {
    if (!cssVar) continue;
    const value = tokens[key as keyof ThemeTokens];
    if (value != null) root.style.setProperty(cssVar, value);
  }

  if (tokens.fontUrl) {
    loadFont(tokens.fontUrl);
  }
}

function loadFont(url: string): void {
  const id = 'theme-font-' + url.replace(/\W/g, '').slice(0, 20);
  if (!document.getElementById(id)) {
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = url;
    document.head.appendChild(link);
  }
}
