/**
 * PromptVault Modern Typography System & Global Typography Engine
 * Centralized Design Tokens, CSS Variables, and Synchronized Settings
 */

import { AppFontFamily, AppFontSize, TypographySettings } from '../types';

export const TYPOGRAPHY_STORAGE_KEY = 'promptvault_typography';

export const DEFAULT_TYPOGRAPHY: TypographySettings = {
  fontFamily: 'Inter',
  fontSize: 16,
};

export interface FontFamilyOption {
  id: AppFontFamily;
  name: string;
  stack: string;
  description: string;
  previewText: string;
}

export const FONT_FAMILY_OPTIONS: FontFamilyOption[] = [
  {
    id: 'Inter',
    name: 'Inter (Default)',
    stack: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    description: 'Tipografi modern, bersih, dan sangat mudah dibaca untuk antarmuka UI.',
    previewText: 'Aa Bb Gg 123 • PromptVault AI Studio',
  },
  {
    id: 'Plus Jakarta Sans',
    name: 'Plus Jakarta Sans',
    stack: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    description: 'Font geometris elegan dengan sentuhan ramah dan kontemporer.',
    previewText: 'Aa Bb Gg 123 • PromptVault AI Studio',
  },
  {
    id: 'SF Pro Display',
    name: 'SF Pro Display',
    stack: "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro', system-ui, sans-serif",
    description: 'Tipografi khas Apple yang presisi, tajam, dan natural di layar modern.',
    previewText: 'Aa Bb Gg 123 • PromptVault AI Studio',
  },
  {
    id: 'Poppins',
    name: 'Poppins',
    stack: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    description: 'Font geometris dengan kurva ramah dan tampilan visual yang tegas.',
    previewText: 'Aa Bb Gg 123 • PromptVault AI Studio',
  },
  {
    id: 'Roboto',
    name: 'Roboto',
    stack: "'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
    description: 'Font klasik Material Design yang kokoh, seimbang, dan andal.',
    previewText: 'Aa Bb Gg 123 • PromptVault AI Studio',
  },
];

export interface FontSizeOption {
  id: string;
  name: string;
  size: AppFontSize;
  label: string;
  description: string;
}

export const FONT_SIZE_OPTIONS: FontSizeOption[] = [
  { id: 'xs', name: 'XS', size: 12, label: 'XS (12px)', description: 'Ekstra Ringkas' },
  { id: 's', name: 'S', size: 14, label: 'S (14px)', description: 'Kompak' },
  { id: 'm', name: 'M', size: 16, label: 'M (16px)', description: 'Standar (Default)' },
  { id: 'l', name: 'L', size: 18, label: 'L (18px)', description: 'Nyaman' },
  { id: 'xl', name: 'XL', size: 20, label: 'XL (20px)', description: 'Besar' },
  { id: 'xxl', name: 'XXL', size: 22, label: 'XXL (22px)', description: 'Ekstra Besar' },
  { id: 'xxxl', name: 'XXXL', size: 24, label: 'XXXL (24px)', description: 'Maksimal' },
];

export function getFontFamilyStack(fontFamily: AppFontFamily): string {
  const match = FONT_FAMILY_OPTIONS.find((f) => f.id === fontFamily);
  return match ? match.stack : FONT_FAMILY_OPTIONS[0].stack;
}

export function getStoredTypography(): TypographySettings {
  if (typeof window === 'undefined') return DEFAULT_TYPOGRAPHY;
  try {
    const saved = localStorage.getItem(TYPOGRAPHY_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.fontFamily && parsed.fontSize) {
        return {
          fontFamily: parsed.fontFamily as AppFontFamily,
          fontSize: Number(parsed.fontSize) as AppFontSize,
        };
      }
    }
  } catch (err) {
    console.warn('Failed to read typography from localStorage:', err);
  }
  return DEFAULT_TYPOGRAPHY;
}

export function saveStoredTypography(settings: TypographySettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TYPOGRAPHY_STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('Failed to save typography to localStorage:', err);
  }
}

export function ensureFontLoaded(fontFamily: AppFontFamily): void {
  if (typeof document === 'undefined') return;
  if ('fonts' in document && (document as any).fonts?.load) {
    (document as any).fonts.load(`16px "${fontFamily}"`).catch(() => {});
  }
}

/**
 * Apply Typography settings globally to the document root, CSS variables, and design tokens
 */
export function applyTypographyToDocument(settings?: Partial<TypographySettings>): void {
  if (typeof document === 'undefined') return;
  const target: TypographySettings = {
    fontFamily: settings?.fontFamily || DEFAULT_TYPOGRAPHY.fontFamily,
    fontSize: (settings?.fontSize || DEFAULT_TYPOGRAPHY.fontSize) as AppFontSize,
  };

  const root = document.documentElement;
  const fontStack = getFontFamilyStack(target.fontFamily);
  const sizePx = `${target.fontSize}px`;

  // 1. Set global design tokens & CSS variables
  root.style.setProperty('--app-font-family', fontStack);
  root.style.setProperty('--font-sans', fontStack);
  root.style.setProperty('--app-font-size', sizePx);
  root.style.setProperty('--app-line-height', '1.5');
  root.style.setProperty('--app-font-weight-normal', '400');
  root.style.setProperty('--app-font-weight-medium', '500');
  root.style.setProperty('--app-font-weight-semibold', '600');
  root.style.setProperty('--app-font-weight-bold', '700');

  // 2. Set root element font size and family to drive proportional rem scaling
  root.style.fontSize = sizePx;
  root.style.fontFamily = fontStack;

  // 3. Set metadata attributes for debugging & targeted CSS rules
  root.setAttribute('data-font', target.fontFamily.toLowerCase().replace(/\s+/g, '-'));
  root.setAttribute('data-font-size', String(target.fontSize));

  if (document.body) {
    document.body.style.fontFamily = fontStack;
  }
  const appRoot = document.getElementById('root');
  if (appRoot) {
    appRoot.style.fontFamily = fontStack;
  }

  // 4. Update or inject dynamic global style tag to enforce font across all components unconditionally
  let styleTag = document.getElementById('dynamic-typography-style') as HTMLStyleElement | null;
  if (!styleTag) {
    styleTag = document.createElement('style');
    styleTag.id = 'dynamic-typography-style';
    document.head.appendChild(styleTag);
  }
  styleTag.textContent = `
    :root {
      --app-font-family: ${fontStack};
      --font-sans: ${fontStack};
    }
    html, body, #root, #app, .font-sans, [class*="font-sans"],
    h1, h2, h3, h4, h5, h6, p, label, button, input:not(.font-mono):not([class*="font-mono"]),
    textarea:not(.font-mono):not([class*="font-mono"]), select, option, optgroup, span:not(.font-mono):not([class*="font-mono"]) {
      font-family: ${fontStack} !important;
    }
  `;

  // 5. Asynchronously load font via FontFace API
  ensureFontLoaded(target.fontFamily);

  // 6. Save to localStorage fallback
  saveStoredTypography(target);
}
