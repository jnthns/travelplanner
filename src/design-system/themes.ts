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

const sakura: ThemePreset = {
  id: 'sakura',
  name: 'Matcha Zenith',
  description: 'Zen minimalism — matcha green on warm cream',
  preview: { primary: '#1f5c2e', secondary: '#3d7a4a', accent: '#1f5c2e', bg: '#edf3ec' },
  tokens: {
    bgColor: '#edf3ec',
    surfaceColor: '#ffffff',
    textPrimary: '#0a1309',
    textSecondary: '#1a2e17',
    textTertiary: '#3a5234',
    primaryColor: '#1f5c2e',
    primaryHover: '#164522',
    secondaryColor: '#3d7a4a',
    secondaryHover: '#2f5f3a',
    accentColor: '#1f5c2e',
    accentHover: '#164522',
    errorColor: '#c62828',
    errorBg: 'rgba(198, 40, 40, 0.1)',
    borderColor: 'rgba(10, 19, 9, 0.14)',
    borderLight: 'rgba(10, 19, 9, 0.08)',
    glassBg: 'rgba(255, 255, 255, 0.92)',
    glassBorder: 'rgba(10, 19, 9, 0.12)',
    shadowSm: '0 1px 2px 0 rgb(10 19 9 / 0.07)',
    shadowMd: '0 4px 12px -2px rgb(10 19 9 / 0.10), 0 2px 4px -1px rgb(10 19 9 / 0.06)',
    shadowLg: '0 16px 32px -6px rgb(10 19 9 / 0.12), 0 6px 12px -3px rgb(10 19 9 / 0.08)',
    radiusSm: '0.375rem',
    radiusMd: '0.5rem',
    radiusLg: '1rem',
    radiusXl: '1.5rem',
    radiusFull: '9999px',
    fontFamily:
      "'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
    fontUrl:
      'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap',
  },
};

const kintsukuroi: ThemePreset = {
  id: 'kintsukuroi',
  name: 'Kintsukuroi',
  description: 'Golden repair on dark warmth',
  preview: { primary: '#c9a84c', secondary: '#a08a3e', accent: '#c9a84c', bg: '#1a1714' },
  tokens: {
    bgColor: '#1a1714',
    surfaceColor: '#242019',
    textPrimary: '#e8e0d4',
    textSecondary: '#9a8e7a',
    textTertiary: '#6b6255',
    primaryColor: '#c9a84c',
    primaryHover: '#b5953f',
    secondaryColor: '#a08a3e',
    secondaryHover: '#8c7735',
    accentColor: '#c9a84c',
    accentHover: '#b5953f',
    errorColor: '#f87171',
    errorBg: '#450a0a',
    borderColor: 'rgba(201,168,76,0.15)',
    borderLight: 'rgba(201,168,76,0.08)',
    glassBg: 'rgba(26,23,20,0.85)',
    glassBorder: 'rgba(201,168,76,0.12)',
    shadowSm: '0 1px 2px 0 rgb(0 0 0 / 0.3)',
    shadowMd: '0 4px 8px -1px rgb(0 0 0 / 0.4), 0 2px 4px -2px rgb(0 0 0 / 0.3)',
    shadowLg: '0 12px 20px -4px rgb(0 0 0 / 0.5), 0 4px 10px -4px rgb(0 0 0 / 0.4)',
    radiusSm: '0.375rem',
    radiusMd: '0.5rem',
    radiusLg: '1rem',
    radiusXl: '1.5rem',
    radiusFull: '9999px',
    fontFamily: "'DM Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontUrl: 'https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap',
  },
};

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

const midnight: ThemePreset = {
  id: 'midnight',
  name: 'Midnight',
  description: 'Deep dark with electric accents',
  preview: { primary: '#818cf8', secondary: '#f472b6', accent: '#38bdf8', bg: '#0c0a1a' },
  tokens: {
    bgColor: '#0c0a1a',
    surfaceColor: '#16132a',
    textPrimary: '#f5f3ff',
    textSecondary: '#c7d2fe',
    textTertiary: '#a5b4fc',
    primaryColor: '#818cf8',
    primaryHover: '#6366f1',
    secondaryColor: '#f472b6',
    secondaryHover: '#ec4899',
    accentColor: '#38bdf8',
    accentHover: '#0ea5e9',
    errorColor: '#fb7185',
    errorBg: '#3f0520',
    borderColor: '#3d3666',
    borderLight: '#2e2654',
    glassBg: 'rgba(22, 19, 42, 0.8)',
    glassBorder: 'rgba(99, 102, 241, 0.2)',
    shadowSm: '0 1px 3px rgb(0 0 0 / 0.4)',
    shadowMd: '0 4px 8px rgb(0 0 0 / 0.5), 0 2px 4px rgb(99 102 241 / 0.08)',
    shadowLg: '0 12px 20px rgb(0 0 0 / 0.6), 0 4px 8px rgb(99 102 241 / 0.1)',
    radiusSm: '0.375rem',
    radiusMd: '0.5rem',
    radiusLg: '1rem',
    radiusXl: '1.5rem',
    radiusFull: '9999px',
    fontFamily: "'Sora', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    fontUrl: 'https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&display=swap',
  },
};

const neon: ThemePreset = {
  id: 'neon',
  name: 'Neon',
  description: 'High-contrast cyberpunk vibes',
  preview: { primary: '#00ff87', secondary: '#ff00e5', accent: '#ffea00', bg: '#0a0a0a' },
  tokens: {
    bgColor: '#0a0a0a',
    surfaceColor: '#141414',
    textPrimary: '#fafafa',
    textSecondary: '#d4d4d8',
    textTertiary: '#a1a1aa',
    primaryColor: '#00ff87',
    primaryHover: '#00cc6a',
    secondaryColor: '#ff00e5',
    secondaryHover: '#cc00b8',
    accentColor: '#ffea00',
    accentHover: '#ccbb00',
    errorColor: '#ff4444',
    errorBg: '#330000',
    borderColor: '#333333',
    borderLight: '#262626',
    glassBg: 'rgba(20, 20, 20, 0.85)',
    glassBorder: 'rgba(0, 255, 135, 0.15)',
    shadowSm: '0 1px 3px rgb(0 0 0 / 0.5)',
    shadowMd: '0 4px 8px rgb(0 0 0 / 0.6), 0 0 12px rgb(0 255 135 / 0.06)',
    shadowLg: '0 8px 24px rgb(0 0 0 / 0.7), 0 0 20px rgb(0 255 135 / 0.08)',
    radiusSm: '0.25rem',
    radiusMd: '0.375rem',
    radiusLg: '0.75rem',
    radiusXl: '1rem',
    radiusFull: '9999px',
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    fontUrl: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap',
  },
};

const terracotta: ThemePreset = {
  id: 'terracotta',
  name: 'Terracotta',
  description: 'Earthy warmth with rich clay tones',
  preview: { primary: '#c2410c', secondary: '#b45309', accent: '#15803d', bg: '#fdf4ef' },
  tokens: {
    bgColor: '#fdf4ef',
    surfaceColor: '#fffaf5',
    textPrimary: '#431407',
    textSecondary: '#7c4a2d',
    textTertiary: '#a67c5c',
    primaryColor: '#c2410c',
    primaryHover: '#9a3412',
    secondaryColor: '#b45309',
    secondaryHover: '#92400e',
    accentColor: '#15803d',
    accentHover: '#166534',
    errorColor: '#dc2626',
    errorBg: '#fef2f2',
    borderColor: '#e8d5c4',
    borderLight: '#f5ece3',
    glassBg: 'rgba(253, 244, 239, 0.75)',
    glassBorder: 'rgba(232, 213, 196, 0.4)',
    shadowSm: '0 1px 3px rgb(194 65 12 / 0.06)',
    shadowMd: '0 4px 8px rgb(194 65 12 / 0.08), 0 2px 4px rgb(180 83 9 / 0.05)',
    shadowLg: '0 10px 20px rgb(194 65 12 / 0.1), 0 4px 8px rgb(180 83 9 / 0.06)',
    radiusSm: '0.375rem',
    radiusMd: '0.5rem',
    radiusLg: '0.875rem',
    radiusXl: '1.25rem',
    radiusFull: '9999px',
    fontFamily: "'Merriweather', Georgia, serif",
    fontUrl: 'https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&display=swap',
  },
};

const sunset: ThemePreset = {
  id: 'sunset',
  name: 'Sunset',
  description: 'Warm editorial neutrals with soft amber',
  preview: { primary: '#c46a2a', secondary: '#8b5e3c', accent: '#e9b86e', bg: '#f8f3eb' },
  tokens: {
    bgColor: '#f8f3eb',
    surfaceColor: '#fffdfa',
    textPrimary: '#2c221b',
    textSecondary: '#6b4b3a',
    textTertiary: '#9a7b67',
    primaryColor: '#c46a2a',
    primaryHover: '#a9551f',
    secondaryColor: '#8b5e3c',
    secondaryHover: '#6f4b31',
    accentColor: '#e9b86e',
    accentHover: '#d49a46',
    errorColor: '#dc2626',
    errorBg: '#fee2e2',
    borderColor: '#eadfce',
    borderLight: '#f5eee3',
    glassBg: 'rgba(248, 243, 235, 0.78)',
    glassBorder: 'rgba(196, 106, 42, 0.16)',
    shadowSm: '0 1px 2px 0 rgb(139 94 60 / 0.05)',
    shadowMd: '0 4px 8px -1px rgb(139 94 60 / 0.08), 0 2px 4px -2px rgb(196 106 42 / 0.05)',
    shadowLg: '0 12px 20px -4px rgb(139 94 60 / 0.1), 0 4px 10px -4px rgb(196 106 42 / 0.06)',
    radiusSm: '0.375rem',
    radiusMd: '0.5rem',
    radiusLg: '1rem',
    radiusXl: '1.5rem',
    radiusFull: '9999px',
    fontFamily: "'Fraunces', Georgia, serif",
    fontUrl: 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&display=swap',
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
    fontFamily: "'M PLUS Rounded 1c', 'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontUrl: 'https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@400;500;700;800&display=swap',
  },
};

const aurora: ThemePreset = {
  id: 'aurora',
  name: 'Aurora',
  description: 'Northern lights — violet and emerald',
  preview: { primary: '#7c3aed', secondary: '#10b981', accent: '#06b6d4', bg: '#f5f3ff' },
  tokens: {
    bgColor: '#f5f3ff',
    surfaceColor: '#ffffff',
    textPrimary: '#1e1b4b',
    textSecondary: '#4c1d95',
    textTertiary: '#8b5cf6',
    primaryColor: '#7c3aed',
    primaryHover: '#6d28d9',
    secondaryColor: '#10b981',
    secondaryHover: '#059669',
    accentColor: '#06b6d4',
    accentHover: '#0891b2',
    errorColor: '#ef4444',
    errorBg: '#fee2e2',
    borderColor: '#ddd6fe',
    borderLight: '#ede9fe',
    glassBg: 'rgba(245, 243, 255, 0.75)',
    glassBorder: 'rgba(221, 214, 254, 0.4)',
    shadowSm: '0 1px 3px rgb(124 58 237 / 0.06)',
    shadowMd: '0 4px 8px rgb(124 58 237 / 0.08), 0 2px 4px rgb(16 185 129 / 0.05)',
    shadowLg: '0 10px 20px rgb(124 58 237 / 0.1), 0 4px 8px rgb(16 185 129 / 0.06)',
    radiusSm: '0.5rem',
    radiusMd: '0.75rem',
    radiusLg: '1.25rem',
    radiusXl: '1.75rem',
    radiusFull: '9999px',
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    fontUrl: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&display=swap',
  },
};

const discord: ThemePreset = {
  id: 'discord',
  name: 'Discord',
  description: 'Discord-style dark — not too dark, blurple accents',
  preview: { primary: '#5865F2', secondary: '#57F287', accent: '#faa61a', bg: '#36393f' },
  tokens: {
    bgColor: '#36393f',
    surfaceColor: '#2f3136',
    textPrimary: '#ffffff',
    textSecondary: '#b9bbbe',
    textTertiary: '#72767d',
    primaryColor: '#5865F2',
    primaryHover: '#4752C4',
    secondaryColor: '#57F287',
    secondaryHover: '#3ba55d',
    accentColor: '#faa61a',
    accentHover: '#e89120',
    errorColor: '#ed4245',
    errorBg: 'rgba(237, 66, 69, 0.15)',
    borderColor: '#40444b',
    borderLight: '#4f545c',
    glassBg: 'rgba(47, 49, 54, 0.85)',
    glassBorder: 'rgba(114, 118, 125, 0.2)',
    shadowSm: '0 1px 2px rgb(0 0 0 / 0.2)',
    shadowMd: '0 4px 6px -1px rgb(0 0 0 / 0.3), 0 2px 4px -2px rgb(0 0 0 / 0.2)',
    shadowLg: '0 10px 15px -3px rgb(0 0 0 / 0.4), 0 4px 6px -4px rgb(0 0 0 / 0.3)',
    radiusSm: '0.375rem',
    radiusMd: '0.5rem',
    radiusLg: '0.75rem',
    radiusXl: '1rem',
    radiusFull: '9999px',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  },
};

const slate: ThemePreset = {
  id: 'slate',
  name: 'Slate',
  description: 'Minimal monochrome — all business',
  preview: { primary: '#475569', secondary: '#1e293b', accent: '#0ea5e9', bg: '#f8fafc' },
  tokens: {
    bgColor: '#f8fafc',
    surfaceColor: '#ffffff',
    textPrimary: '#0f172a',
    textSecondary: '#475569',
    textTertiary: '#94a3b8',
    primaryColor: '#475569',
    primaryHover: '#334155',
    secondaryColor: '#1e293b',
    secondaryHover: '#0f172a',
    accentColor: '#0ea5e9',
    accentHover: '#0284c7',
    errorColor: '#dc2626',
    errorBg: '#fee2e2',
    borderColor: '#e2e8f0',
    borderLight: '#f1f5f9',
    glassBg: 'rgba(255, 255, 255, 0.7)',
    glassBorder: 'rgba(255, 255, 255, 0.3)',
    shadowSm: '0 1px 2px rgb(0 0 0 / 0.05)',
    shadowMd: '0 4px 6px -1px rgb(0 0 0 / 0.08)',
    shadowLg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
    radiusSm: '0.25rem',
    radiusMd: '0.375rem',
    radiusLg: '0.75rem',
    radiusXl: '1rem',
    radiusFull: '9999px',
    fontFamily: "'Public Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontUrl: 'https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700&display=swap',
  },
};

const tropics: ThemePreset = {
  id: 'tropics',
  name: 'Tropics',
  description: 'Lush island colors, bold and vivid',
  preview: { primary: '#0891b2', secondary: '#e11d48', accent: '#eab308', bg: '#ecfeff' },
  tokens: {
    bgColor: '#ecfeff',
    surfaceColor: '#ffffff',
    textPrimary: '#164e63',
    textSecondary: '#0e7490',
    textTertiary: '#67b9ce',
    primaryColor: '#0891b2',
    primaryHover: '#0e7490',
    secondaryColor: '#e11d48',
    secondaryHover: '#be123c',
    accentColor: '#eab308',
    accentHover: '#ca8a04',
    errorColor: '#dc2626',
    errorBg: '#fef2f2',
    borderColor: '#cffafe',
    borderLight: '#ecfeff',
    glassBg: 'rgba(236, 254, 255, 0.75)',
    glassBorder: 'rgba(207, 250, 254, 0.4)',
    shadowSm: '0 1px 3px rgb(8 145 178 / 0.06)',
    shadowMd: '0 4px 8px rgb(8 145 178 / 0.1), 0 2px 4px rgb(225 29 72 / 0.05)',
    shadowLg: '0 10px 20px rgb(8 145 178 / 0.12), 0 4px 8px rgb(225 29 72 / 0.06)',
    radiusSm: '0.5rem',
    radiusMd: '0.75rem',
    radiusLg: '1.25rem',
    radiusXl: '1.75rem',
    radiusFull: '9999px',
    fontFamily: "'Bricolage Grotesque', 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontUrl: 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;500;600;700&display=swap',
  },
};

/** Presets that are dark by default; dark mode toggle is hidden and these are shown in a separate "Dark themes" section. */
export const DARK_PRESET_IDS = ['discord', 'neon', 'midnight', 'kintsukuroi'] as const;

export function isDarkPreset(presetId: string): boolean {
  return (DARK_PRESET_IDS as readonly string[]).includes(presetId);
}

export const THEME_PRESETS: ThemePreset[] = [
  sakura, kintsukuroi,
  modern, sunset, ocean,
  aurora, tropics,
  terracotta, slate,
  discord, midnight, neon,
];

const THEME_CONFIG_KEY = 'travelplanner_theme_config';
const LEGACY_THEME_KEY = 'travelplanner_theme';

export function loadThemeConfig(): ThemeConfig {
  try {
    const raw = localStorage.getItem(THEME_CONFIG_KEY);
    if (raw) {
      const config = JSON.parse(raw) as ThemeConfig;
      return config;
    }

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
  return { presetId: 'sakura', colorOverrides: {} };
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

function lightenHex(hex: string, amount = 0.2): string {
  const c = hex.replace('#', '');
  const num = parseInt(c, 16);
  const r = Math.min(255, Math.round(((num >> 16) & 0xff) + (255 - ((num >> 16) & 0xff)) * amount));
  const g = Math.min(255, Math.round(((num >> 8) & 0xff) + (255 - ((num >> 8) & 0xff)) * amount));
  const b = Math.min(255, Math.round((num & 0xff) + (255 - (num & 0xff)) * amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function blendHex(baseHex: string, targetHex: string, amount = 0.5): string {
  const a = baseHex.replace('#', '');
  const b = targetHex.replace('#', '');
  const base = parseInt(a, 16);
  const target = parseInt(b, 16);
  const weight = Math.max(0, Math.min(1, amount));
  const r = Math.round(((base >> 16) & 0xff) * (1 - weight) + ((target >> 16) & 0xff) * weight);
  const g = Math.round(((base >> 8) & 0xff) * (1 - weight) + ((target >> 8) & 0xff) * weight);
  const blue = Math.round((base & 0xff) * (1 - weight) + (target & 0xff) * weight);
  return `#${((r << 16) | (g << 8) | blue).toString(16).padStart(6, '0')}`;
}

export function getDarkTokens(tokens: ThemeTokens): ThemeTokens {
  const primary = tokens.primaryColor.startsWith('#') ? lightenHex(tokens.primaryColor, 0.15) : tokens.primaryColor;
  const secondary = tokens.secondaryColor.startsWith('#') ? lightenHex(tokens.secondaryColor, 0.15) : tokens.secondaryColor;
  const accent = tokens.accentColor.startsWith('#') ? lightenHex(tokens.accentColor, 0.1) : tokens.accentColor;
  const bg = tokens.primaryColor.startsWith('#') ? blendHex('#0b1120', tokens.primaryColor, 0.08) : '#0f172a';
  const surface = tokens.primaryColor.startsWith('#') ? blendHex('#162033', tokens.primaryColor, 0.14) : '#1e293b';
  const textSecondary = tokens.primaryColor.startsWith('#') ? blendHex('#dbe4f2', primary, 0.14) : '#cbd5e1';
  const textTertiary = tokens.accentColor.startsWith('#') ? blendHex('#9fb0c7', accent, 0.1) : '#94a3b8';
  const border = tokens.primaryColor.startsWith('#') ? blendHex('#334155', primary, 0.18) : '#334155';
  const borderLight = tokens.primaryColor.startsWith('#') ? blendHex('#1e293b', primary, 0.1) : '#1e293b';

  return {
    ...tokens,
    bgColor: bg,
    surfaceColor: surface,
    textPrimary: '#f8fbff',
    textSecondary,
    textTertiary,
    primaryColor: primary,
    primaryHover: tokens.primaryColor,
    secondaryColor: secondary,
    secondaryHover: tokens.secondaryColor,
    accentColor: accent,
    accentHover: tokens.accentColor,
    errorColor: '#f87171',
    errorBg: '#450a0a',
    borderColor: border,
    borderLight,
    glassBg: 'rgba(17, 24, 39, 0.78)',
    glassBorder: 'rgba(148, 163, 184, 0.22)',
    shadowSm: '0 1px 2px 0 rgb(0 0 0 / 0.3)',
    shadowMd: '0 4px 6px -1px rgb(0 0 0 / 0.4), 0 2px 4px -2px rgb(0 0 0 / 0.3)',
    shadowLg: '0 10px 15px -3px rgb(0 0 0 / 0.5), 0 4px 6px -4px rgb(0 0 0 / 0.4)',
  };
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

export function preloadPresetFonts(): void {
  THEME_PRESETS.forEach((preset) => {
    if (preset.tokens.fontUrl) loadFont(preset.tokens.fontUrl);
  });
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
