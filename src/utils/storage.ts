import { FolderItem, PromptItem, TagItem } from '../types';
import { INITIAL_FOLDERS, INITIAL_PROMPTS } from '../data/initialData';

const PROMPTS_STORAGE_KEY = 'promptvault_prompts_v2';
const FOLDERS_STORAGE_KEY = 'promptvault_folders_v2';
const TAGS_STORAGE_KEY = 'promptvault_tags_v2';
const THEME_STORAGE_KEY = 'promptvault_theme';

// Load Theme from LocalStorage (defaults to 'dark' if none set)
export function getStoredTheme(): 'dark' | 'light' {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
  } catch (err) {
    console.error('Error reading theme from localStorage:', err);
  }
  return 'dark'; // Dark mode default as specified
}

// Save Theme preference to LocalStorage
export function saveStoredTheme(theme: 'dark' | 'light'): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (err) {
    console.error('Error saving theme to localStorage:', err);
  }
}

// Directly apply theme class and data-theme to document & update meta theme-color
export function applyThemeToDocument(theme: 'dark' | 'light'): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const isLight = theme === 'light';

  root.classList.toggle('light', isLight);
  root.classList.toggle('dark', !isLight);
  root.setAttribute('data-theme', theme);

  if (document.body) {
    document.body.classList.toggle('light', isLight);
    document.body.classList.toggle('dark', !isLight);
  }

  // Update mobile status bar & PWA theme color
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', isLight ? '#6D3DF5' : '#020617');
  }
}

// Extract dynamic variables from prompt text e.g. [topic], {audience}, {{role}}
export function extractVariablesFromPrompt(text: string): string[] {
  if (!text) return [];
  const matches = text.match(/(\[[a-zA-Z0-9_\-\s]+\]|\{[a-zA-Z0-9_\-\s]+\}|\{\{[a-zA-Z0-9_\-\s]+\}\})/g);
  if (!matches) return [];
  const cleaned = matches.map((m) => m.replace(/[\{\}\[\]]/g, '').trim()).filter((v) => v.length > 0);
  return Array.from(new Set(cleaned));
}

// Load Prompts from LocalStorage or Initial Data
export function getStoredPrompts(): PromptItem[] {
  try {
    const raw = localStorage.getItem(PROMPTS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(PROMPTS_STORAGE_KEY, JSON.stringify(INITIAL_PROMPTS));
      return INITIAL_PROMPTS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_PROMPTS;
  } catch (err) {
    console.error('Error reading prompts from localStorage:', err);
    return INITIAL_PROMPTS;
  }
}

// Save Prompts to LocalStorage
export function savePromptsToStorage(prompts: PromptItem[]): void {
  try {
    localStorage.setItem(PROMPTS_STORAGE_KEY, JSON.stringify(prompts));
  } catch (err) {
    console.error('Error saving prompts to localStorage:', err);
  }
}

// Load Folders from LocalStorage or Initial Data
export function getStoredFolders(): FolderItem[] {
  try {
    const raw = localStorage.getItem(FOLDERS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(INITIAL_FOLDERS));
      return INITIAL_FOLDERS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_FOLDERS;
  } catch (err) {
    console.error('Error reading folders from localStorage:', err);
    return INITIAL_FOLDERS;
  }
}

// Save Folders to LocalStorage
export function saveFoldersToStorage(folders: FolderItem[]): void {
  try {
    localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(folders));
  } catch (err) {
    console.error('Error saving folders to localStorage:', err);
  }
}

// Load Tags from LocalStorage or seed from existing Prompts
export function getStoredTags(existingPrompts?: PromptItem[]): TagItem[] {
  try {
    const raw = localStorage.getItem(TAGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading tags from localStorage:', err);
  }

  // Seed tags from current prompts or initial prompts
  const sourcePrompts = existingPrompts && existingPrompts.length > 0 ? existingPrompts : INITIAL_PROMPTS;
  const tagMap = new Map<string, string>(); // normalized -> original name

  sourcePrompts.forEach((prompt) => {
    if (Array.isArray(prompt.tags)) {
      prompt.tags.forEach((t) => {
        const trimmed = (t || '').trim();
        if (trimmed) {
          const norm = trimmed.toLowerCase();
          if (!tagMap.has(norm)) {
            tagMap.set(norm, trimmed);
          }
        }
      });
    }
  });

  const seededTags: TagItem[] = Array.from(tagMap.entries()).map(([norm, name], index) => ({
    id: `tag-${Date.now()}-${index}`,
    name,
    normalizedName: norm,
    isActive: true,
    createdAt: new Date().toISOString(),
  }));

  try {
    localStorage.setItem(TAGS_STORAGE_KEY, JSON.stringify(seededTags));
  } catch (e) {
    console.error('Failed to seed tags in storage:', e);
  }

  return seededTags;
}

// Save Tags to LocalStorage
export function saveTagsToStorage(tags: TagItem[]): void {
  try {
    localStorage.setItem(TAGS_STORAGE_KEY, JSON.stringify(tags));
  } catch (err) {
    console.error('Error saving tags to localStorage:', err);
  }
}

// Convert File object to compressed Base64 data URL (max 1000px, JPEG quality 0.75)
export function fileToBase64(file: File, maxWidth = 1000, maxHeight = 1000, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/') || file.type.includes('svg')) {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const rawResult = e.target?.result as string;
      if (!rawResult) return reject(new Error('Failed to read file'));

      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(rawResult);
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed);
      };
      img.onerror = () => resolve(rawResult);
      img.src = rawResult;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

// Compress existing base64 image data URL to stay safely under size limits
export function compressBase64Image(dataUrl: string, maxWidth = 800, maxHeight = 800, quality = 0.7): Promise<string> {
  return new Promise((resolve) => {
    if (!dataUrl || !dataUrl.startsWith('data:image/') || dataUrl.includes('image/svg')) {
      return resolve(dataUrl);
    }
    if (dataUrl.length < 150000) {
      return resolve(dataUrl);
    }

    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > maxWidth || height > maxHeight) {
        if (width / height > maxWidth / maxHeight) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(dataUrl);

      ctx.drawImage(img, 0, 0, width, height);
      const compressed = canvas.toDataURL('image/jpeg', quality);
      resolve(compressed);
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// Export Vault Data as JSON string download
export function exportVaultDataJSON(prompts: PromptItem[], folders: FolderItem[]): void {
  const exportPayload = {
    app: 'PromptVault',
    version: '1.0',
    exportedAt: new Date().toISOString(),
    folders,
    prompts,
  };

  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `promptvault-backup-${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

// Copy text to clipboard with fallback
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    textArea.remove();
    return successful;
  } catch (err) {
    console.error('Copy to clipboard failed:', err);
    return false;
  }
}

/**
 * Automatically sorts folders by name using natural alphanumeric sorting:
 * - If folder names start with numbers (01, 02, 03... or 1, 2, 3...), they are sorted numerically from smallest to largest.
 * - Non-numeric folder names are sorted alphabetically from A to Z.
 * - Lock status (locked or unlocked) does not affect the sorting order.
 */
export function sortFoldersByName<T extends { name?: string } = FolderItem>(folders: T[]): T[] {
  return [...folders].sort((a, b) => {
    const nameA = (a.name || '').trim();
    const nameB = (b.name || '').trim();
    return nameA.localeCompare(nameB, undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  });
}
